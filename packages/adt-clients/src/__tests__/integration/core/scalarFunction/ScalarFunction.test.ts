/**
 * Integration test for ScalarFunction (CDS DSFD/SCF)
 * Tests using AdtClient for unified CRUD operations.
 *
 * Whether DSFD exists on a system is the configuration's to say — the case's
 * `enabled` / `available_in`, read by the registration gate — never inferred
 * from an answer: an enabled case whose create is refused, 404/405/501
 * included, fails with what SAP said.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - ScalarFunction library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=scalarFunction/ScalarFunction
 */

import { randomBytes } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseActivation,
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import {
  expectResult,
  failureOf,
  noteCleanupRefusal,
  releasing,
} from '../../../helpers/contract';
import { judged } from '../../../helpers/judged';
import { expectLockReleased } from '../../../helpers/lockReleased';
import { removeLeftover } from '../../../helpers/objectPresence';
import {
  readRootDescription,
  replaceRootDescription,
} from '../../../helpers/rootDescription';
import {
  createTestAdtClient,
  createTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
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
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
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

describe('ScalarFunction (DSFD/SCF) integration', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
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
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  describe('Full workflow', () => {
    gate('create_scalar_function', 'adt_scalar_function')(
      'create → read → update → activate → delete',
      async () => {
        const TEST_LABEL = 'ScalarFunction - full workflow';

        // Resolve test-case params from test-config.yaml (key: create_scalar_function)
        const testCase = configuredCase(
          'create_scalar_function',
          'adt_scalar_function',
        );
        if (!testCase) {
          throw new Error(
            missingCaseMessage('create_scalar_function', 'adt_scalar_function'),
          );
        }

        // Determine object name and package from config or defaults
        const resolver = new TestConfigResolver({
          testCase,
          isCloud: isCloudSystem,
          logger: testsLogger,
        });

        const scalarFunctionName: string =
          testCase?.params?.scalar_function_name ?? 'ZADT_SCALAR_FUNC';

        const packageName: string | null =
          resolver.getPackageName() ||
          resolvePackageName(testCase?.params?.package_name);

        logTestStart(testsLogger, TEST_LABEL, {
          name: scalarFunctionName,
          params: { package_name: packageName },
        });

        if (!packageName) {
          throw new Error(
            'package_name not configured — set environment.default_package in test-config.yaml',
          );
        }

        const transportRequest: string | undefined = resolveTransportRequest(
          testCase?.params?.transport_request,
        );

        const sf = client.getScalarFunction();

        // ── 1) Idempotent cleanup of any leftover object from a previous run ──
        // Read first, delete only what is there: ABAP cloud refuses a second
        // delete of a DSFD it already removed ("ADT refuses to delete …"; the
        // deletion check says "Object does not exist"), measured 2026-10-28.
        await removeLeftover(
          `delete leftover scalar function ${scalarFunctionName}`,
          () =>
            sf.readMetadata(
              { scalarFunctionName },
              { analyse: analyseException },
            ),
          () =>
            sf.delete(
              {
                scalarFunctionName,
                transportRequest,
              },
              {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(sf, 'delete'),
              },
            ),
        );

        // ── 2) Create (also confirms DSFD is supported on this system) ──
        // A refused create fails with what SAP said, 404/405/501 included:
        // whether DSFD is there is the case's `enabled` / `available_in`, not
        // an answer to read it from.
        const created = await sf.create(
          {
            scalarFunctionName,
            packageName,
            transportRequest,
            description: 'ADT integration test scalar function',
          },
          {
            analyse: analyseException,
            headers: integrationHeadersOf(sf, 'create'),
          },
        );
        if (!created.ok) {
          const createError = new Error(
            failureOf(created, 'create scalar function'),
          );
          logTestError(testsLogger, TEST_LABEL, createError);
          throw createError;
        }

        try {
          // A CDS scalar function can only ACTIVATE when its source is backed by an
          // AMDP method (`CLASS-METHODS ... FOR SCALAR FUNCTION ... BY DATABASE
          // FUNCTION FOR HDB LANGUAGE SQLSCRIPT`) that exists on the target system —
          // an environment-specific fixture. So the update/activate flow runs ONLY
          // when a valid `source_code` is configured in
          // create_scalar_function.params.source_code (and the companion AMDP class
          // is deployed). Otherwise we validate the DSFD wire contract via
          // create → read → delete, which needs no AMDP fixture.
          // {name} is substituted here so the DDL can never declare an object
          // other than the one the test created — the config invites renaming
          // scalar_function_name, and a hardcoded name in the source would then
          // create one object and try to fill another.
          const configuredSource: string | undefined = (
            testCase?.params?.source_code as string | undefined
          )?.replaceAll('{name}', scalarFunctionName);

          if (configuredSource) {
            // ── 3a) Full flow: update source + activate ──
            const sfLock = expectResult(
              await sf.lock(
                { scalarFunctionName },
                { analyse: analyseException },
              ),
              'lock scalar function',
            );
            await releasing(
              async () =>
                expectResult(
                  await sf.update(
                    { scalarFunctionName, transportRequest },
                    {
                      analyse: analyseException,
                      headers: integrationHeadersOf(sf, 'update'),
                      source: configuredSource,
                      lockHandle: sfLock,
                    },
                  ),
                  'update scalar function',
                ),
              () =>
                sf.unlock({ scalarFunctionName }, sfLock, {
                  analyse: analyseException,
                }),
              'unlock scalar function',
            );
            await expectLockReleased(
              (c) => c.getScalarFunction(),
              { scalarFunctionName },
              `scalar function ${scalarFunctionName}`,
              testsLogger,
            );
            expectResult(
              await sf.activate(
                { scalarFunctionName },
                {
                  analyse: judged(analyseActivation),
                  headers: integrationHeadersOf(sf, 'activate'),
                },
              ),
              'activate scalar function',
            );

            // ── 4a) Read active ──
            const readState = expectResult(
              await sf.read({ scalarFunctionName }, 'active', {
                analyse: analyseException,
              }),
              'readState',
            );
            expect(typeof readState).toBe('string');

            // ── 4b) Metadata update: the whole document, its description changed ──
            const description = `MCP metadata ${randomBytes(4).toString('hex')}`;
            const current = expectResult(
              await sf.readMetadata(
                { scalarFunctionName },
                { analyse: analyseException },
              ),
              'readMetadata scalar function',
            );
            const patched = replaceRootDescription(
              String(current),
              description,
              'ScalarFunction',
            );
            const mdLock = expectResult(
              await sf.lock(
                { scalarFunctionName },
                { analyse: analyseException },
              ),
              'lock scalar function (metadata)',
            );
            await releasing(
              async () =>
                expectResult(
                  await sf.updateMetadata(
                    { scalarFunctionName, transportRequest },
                    {
                      analyse: analyseException,
                      headers: integrationHeadersOf(sf, 'updateMetadata'),
                      source: patched,
                      lockHandle: mdLock,
                    },
                  ),
                  'updateMetadata scalar function',
                ),
              () =>
                sf.unlock({ scalarFunctionName }, mdLock, {
                  analyse: analyseException,
                }),
              'unlock scalar function (metadata)',
            );
            expectResult(
              await sf.activate(
                { scalarFunctionName },
                {
                  analyse: judged(analyseActivation),
                  headers: integrationHeadersOf(sf, 'activate'),
                },
              ),
              'activate scalar function (after metadata update)',
            );
            const after = expectResult(
              await sf.readMetadata(
                { scalarFunctionName },
                { analyse: analyseException },
              ),
              'readMetadata scalar function (after metadata update)',
            );
            expect(readRootDescription(String(after))).toBe(description);
          } else {
            // ── 3b) Metadata-only validation: read the inactive object back ──
            const readState = expectResult(
              await sf.read({ scalarFunctionName }, 'inactive', {
                analyse: analyseException,
              }),
              'readState',
            );
            expect(typeof readState).toBe('string');
          }

          // ── 5) Delete ──
          const deleteState = expectResult(
            await sf.delete(
              {
                scalarFunctionName,
                transportRequest,
              },
              {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(sf, 'delete'),
              },
            ),
            'deleteState',
          );
          expect(deleteState).toBeDefined();

          logTestSuccess(testsLogger, TEST_LABEL);
        } catch (error) {
          logTestError(testsLogger, TEST_LABEL, error);
          // The test already failed; a refused cleanup is added to that
          // failure, not dropped.
          await noteCleanupRefusal(
            error,
            () =>
              sf.delete(
                { scalarFunctionName, transportRequest },
                {
                  analyse: judged(analyseDeletion),
                  headers: integrationHeadersOf(sf, 'delete'),
                },
              ),
            `delete scalar function ${scalarFunctionName}`,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, TEST_LABEL);
        }
      },
      getTimeout('test'),
    );
  });

  // `Read standard object` was here, and it had never run: it asked for a
  // config section (`read_scalar_function`) that exists in neither the working
  // config nor the template, so it logged SKIP and the suite went green having
  // read nothing. Adding the section made it run, and it failed — there is
  // nothing for it to read.
  //
  // A DSFD has no SAP-delivered example to name, and no shared one exists: the
  // only `ZADT_SCALAR_FUNC` is the subject the flow above creates and deletes,
  // so pointing the case at it races that flow rather than covering anything.
  // The read is exercised by that flow — create, read, update, activate,
  // delete — so removing a test that cannot run loses no coverage. Worth
  // restoring if a shared scalar function is ever added to
  // `shared_dependencies`.
});
