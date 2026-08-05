/**
 * Integration test for AppendStructure (TABL/DS append).
 * Tests using AdtClient for unified CRUD operations covering two base variants:
 * - structure base (extends an existing DDIC structure)
 * - table base (extends an existing transparent table)
 *
 * Skip gate: HTTP 404/405/501 → feature absent on this system (silently skip).
 * All other errors (401/403/timeout/5xx) are real failures and are rethrown.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=appendStructure/AppendStructure
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getEnabledTestCase,
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

/** HTTP status codes that indicate append structures are absent on this system. */
const SKIP_STATUSES = new Set([404, 405, 501]);

describe('AppendStructure (TABL/DS) integration', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
      hasConfig = true;
    } catch (_error) {
      hasConfig = false;
    }
  });

  const cases: Array<{
    label: string;
    baseKey: 'base_structure' | 'base_table';
  }> = [
    { label: 'structure base', baseKey: 'base_structure' },
    { label: 'table base', baseKey: 'base_table' },
  ];

  for (const { label, baseKey } of cases) {
    describe(`Full workflow — ${label}`, () => {
      it(
        'create → read → update → activate → delete (skips only on 404/405/501)',
        async () => {
          const TEST_LABEL = `AppendStructure - full workflow (${label})`;

          // Resolve test-case params from test-config.yaml (key: create_append_structure)
          const testCase = getEnabledTestCase(
            'create_append_structure',
            'adt_append_structure',
          );

          const resolver = new TestConfigResolver({
            testCase,
            isCloud: isCloudSystem,
            logger: testsLogger,
          });

          // Derive a unique name per base variant by suffixing _S (structure) or _T (table)
          const baseName: string =
            testCase?.params?.append_structure_name ?? 'ZADT_S_APPEND';
          const suffix = baseKey === 'base_table' ? '_T' : '_S';
          const appendStructureName = `${baseName}${suffix}`;

          const baseObject: string | undefined = testCase?.params?.[baseKey];

          const packageName: string | null =
            resolver.getPackageName() ||
            resolvePackageName(testCase?.params?.package_name);

          logTestStart(testsLogger, TEST_LABEL, {
            name: appendStructureName,
            params: {
              package_name: packageName,
              base_object: baseObject,
              base_key: baseKey,
            },
          });

          if (!hasConfig) {
            logTestSkip(testsLogger, TEST_LABEL, 'No SAP configuration');
            return;
          }

          if (!packageName) {
            logTestSkip(
              testsLogger,
              TEST_LABEL,
              'package_name not configured — set environment.default_package in test-config.yaml',
            );
            return;
          }

          if (!baseObject) {
            logTestSkip(
              testsLogger,
              TEST_LABEL,
              `${baseKey} not configured in test-config.yaml (create_append_structure.params.${baseKey})`,
            );
            return;
          }

          const transportRequest: string | undefined = resolveTransportRequest(
            testCase?.params?.transport_request,
          );

          // Preflight: the base object is a PREREQUISITE (like the root package) —
          // the suite does not create base tables/structures. If the configured base
          // does not exist, skip with a clear reason instead of hard-failing on create.
          let baseExists = true;
          try {
            // NOTE: read() 404 semantics differ — getStructure().read() returns
            // undefined, but getTable().read() returns { readResult: undefined }.
            // Check readResult for the table case to detect a missing base.
            if (baseKey === 'base_table') {
              const baseState = await client
                .getTable()
                .read({ tableName: baseObject });
              baseExists = !!baseState?.readResult;
            } else {
              const baseState = await client
                .getStructure()
                .read({ structureName: baseObject });
              baseExists = !!baseState;
            }
          } catch (baseError) {
            const status = (baseError as { response?: { status?: number } })
              .response?.status;
            if (status === 404) {
              baseExists = false;
            } else {
              throw baseError;
            }
          }
          if (!baseExists) {
            logTestSkip(
              testsLogger,
              TEST_LABEL,
              `base ${baseKey} '${baseObject}' does not exist — create it or set create_append_structure.params.${baseKey} to an existing object`,
            );
            return;
          }

          const as = client.getAppendStructure();

          // ── 1) Idempotent cleanup of any leftover object from a previous run ──
          try {
            await as.delete({ appendStructureName, transportRequest });
          } catch {
            // Ignore — object may not exist yet
          }

          // ── 2) Create (also confirms append structures are supported on this system) ──
          try {
            await as.create({
              appendStructureName,
              baseObject,
              packageName,
              transportRequest,
              description: 'ADT integration test append structure',
            });
          } catch (createError) {
            const status = (createError as { response?: { status?: number } })
              .response?.status;
            if (status && SKIP_STATUSES.has(status)) {
              logTestSkip(
                testsLogger,
                TEST_LABEL,
                `Append structures unsupported on this system (HTTP ${status})`,
              );
              return;
            }
            logTestError(testsLogger, TEST_LABEL, createError);
            throw createError;
          }

          try {
            // ── 3) Update source + activate ──
            // The ABAP lives in test-config.yaml, not here. Which field name
            // and which type are allowed is a DDIC rule — only zz_* may be
            // appended, and the type must match the base's #EXTENSIBLE_*
            // category — so it is configuration, not a literal to bury in a
            // test file where nobody looks for it.
            const template: string | undefined = testCase?.params?.source_code;
            if (!template) {
              throw new Error(
                'create_append_structure.params.source_code is not configured',
              );
            }
            const source = template
              .replaceAll('{base}', baseObject)
              .replaceAll('{append}', appendStructureName);

            await as.update(
              { appendStructureName, transportRequest, sourceCode: source },
              { activateOnUpdate: true },
            );

            // ── 4) Read back — the CONTENT, not the status ──
            // This system answers 200 with an empty body for an object that was
            // created but never filled, so asserting the status alone cannot
            // tell a written append from an empty shell. It did not, and the
            // consequence was a test that passed while leaving this behind:
            //
            //   extend type zac_shr_appstru with zadt_s_append_s {
            //   }
            //
            // Assert the field actually arrived.
            const readState = await as.read({ appendStructureName }, 'active');
            expect(readState).toBeDefined();
            expect(readState?.readResult).toBeDefined();
            expect((readState?.readResult as any)?.status).toBe(200);

            const writtenSource = String(
              (readState?.readResult as { data?: unknown })?.data ?? '',
            );
            const fieldName = /^\s*(zz_\w+)\s*:/m.exec(source)?.[1];
            expect(fieldName).toBeDefined();
            expect(writtenSource).toContain(fieldName as string);

            // ── 5) Delete ──
            const deleteState = await as.delete({
              appendStructureName,
              transportRequest,
            });
            expect(deleteState.deleteResult).toBeDefined();

            logTestSuccess(testsLogger, TEST_LABEL);
          } catch (error) {
            logTestError(testsLogger, TEST_LABEL, error);
            // Best-effort cleanup
            try {
              await as.delete({ appendStructureName, transportRequest });
            } catch {
              // Ignore cleanup errors
            }
            throw error;
          } finally {
            logTestEnd(testsLogger, TEST_LABEL);
          }
        },
        getTimeout('test'),
      );
    });
  }
});
