/**
 * Integration test for ScalarFunctionImplementation (CDS DSFI/SFI).
 *
 * Builds the full, self-contained scalar-function fixture and verifies the DSFI
 * client end-to-end (the sources are deterministic, so they are built inline —
 * no source params required in test-config.yaml):
 *   1. DSFD signature (define scalar function ... with parameters ... returns ...) + activate
 *   2. AMDP class (IF_AMDP_MARKER_HDB, CLASS-METHODS ... FOR SCALAR FUNCTION ...,
 *      BY DATABASE FUNCTION FOR HDB LANGUAGE SQLSCRIPT) — created, group-activated
 *   3. DSFI: create (blues v2 + base64 binding) → update() the implementation JSON
 *      (PUT /source/main, application/json, sets amdpReference) → group-activate the trio
 *   4. read (JSON source, verifies amdpReference) + readMetadata (blues v2) + delete all three
 *
 * Skip gate: HTTP 404/405/501 from the DSFD/DSFI create → the feature is absent
 * on this system; the suite is skipped. All other errors fail the test.
 *
 * Run: npm test -- --testPathPatterns=scalarFunctionImplementation/ScalarFunctionImplementation
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

/** HTTP status codes that indicate the DSFI/DSFD feature is absent on this system. */
const SKIP_STATUSES = new Set([404, 405, 501]);

function isSkippable(error: unknown): boolean {
  const status = (error as { response?: { status?: number } }).response?.status;
  return !!status && SKIP_STATUSES.has(status);
}

describe('ScalarFunctionImplementation (DSFI/SFI) integration', () => {
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

  describe('Full workflow', () => {
    it(
      'DSFD + AMDP + DSFI fixture: create → impl update → group-activate → read → updateMetadata → delete',
      async () => {
        const TEST_LABEL = 'ScalarFunctionImplementation - full workflow';

        const testCase = getEnabledTestCase(
          'create_scalar_function_implementation',
          'adt_scalar_function_implementation',
        );
        const resolver = new TestConfigResolver({
          testCase,
          isCloud: isCloudSystem,
          logger: testsLogger,
        });

        const implName: string =
          testCase?.params?.implementation_name ?? 'ZADT_SCALAR_FUNC_SQL';
        const funcName: string =
          testCase?.params?.scalar_function_name ?? 'ZADT_SCALAR_FUNC';
        const amdpName: string =
          testCase?.params?.amdp_class_name ?? 'ZADT_SCALAR_AMDP';
        const packageName: string | null =
          resolver.getPackageName() ||
          resolvePackageName(testCase?.params?.package_name);
        const transportRequest: string | undefined = resolveTransportRequest(
          testCase?.params?.transport_request,
        );

        logTestStart(testsLogger, TEST_LABEL, {
          name: implName,
          params: { function: funcName, amdp: amdpName, package: packageName },
        });

        if (!hasConfig) {
          logTestSkip(testsLogger, TEST_LABEL, 'No SAP configuration');
          return;
        }
        if (!packageName) {
          logTestSkip(
            testsLogger,
            TEST_LABEL,
            'package_name not configured — set environment.default_package',
          );
          return;
        }

        const sf = client.getScalarFunction();
        const cls = client.getClass();
        const dsfi = client.getScalarFunctionImplementation();

        // Deterministic, self-contained sources for the fixture.
        const sigSource =
          `define scalar function ${funcName}\n` +
          `  with parameters\n    p_a: abap.int1,\n    p_b: abap.int1\n` +
          `  returns abap.int1`;
        const amdpSource =
          `CLASS ${amdpName.toLowerCase()} DEFINITION PUBLIC FINAL CREATE PUBLIC.\n` +
          `  PUBLIC SECTION.\n    INTERFACES if_amdp_marker_hdb.\n` +
          `    CLASS-METHODS get_sum FOR SCALAR FUNCTION ${funcName}.\n` +
          `  PROTECTED SECTION.\n  PRIVATE SECTION.\nENDCLASS.\n\n` +
          `CLASS ${amdpName.toLowerCase()} IMPLEMENTATION.\n` +
          `  METHOD get_sum BY DATABASE FUNCTION FOR HDB LANGUAGE SQLSCRIPT OPTIONS READ-ONLY.\n` +
          `    result = :p_a + :p_b;\n  ENDMETHOD.\nENDCLASS.`;
        const implSource = JSON.stringify({
          formatVersion: '1',
          header: {
            description: 'AdtScalarFunctionImplementation integration test',
            originalLanguage: 'en',
            abapLanguageVersion: 'cloudDevelopment',
          },
          scalarFunctionName: funcName,
          engine: 'sqlEngine',
          sqlProperties: {
            amdpReference: `${amdpName}=>GET_SUM`,
            autoExposedInSqlServices: true,
          },
        });

        // Idempotent cleanup (impl → amdp → func) of any leftovers.
        const cleanup = async () => {
          try {
            await dsfi.delete({ implementationName: implName });
          } catch {
            /* ignore */
          }
          try {
            await cls.delete({ className: amdpName });
          } catch {
            /* ignore */
          }
          try {
            await sf.delete({ scalarFunctionName: funcName, transportRequest });
          } catch {
            /* ignore */
          }
        };
        await cleanup();

        try {
          // 1) DSFD signature + activate (a definition activates standalone).
          try {
            await sf.create({
              scalarFunctionName: funcName,
              packageName,
              transportRequest,
              description: 'DSFI integration companion function',
            });
          } catch (e) {
            if (isSkippable(e)) {
              logTestSkip(
                testsLogger,
                TEST_LABEL,
                'DSFD/DSFI unsupported here',
              );
              return;
            }
            throw e;
          }
          await sf.update(
            {
              scalarFunctionName: funcName,
              transportRequest,
              sourceCode: sigSource,
            },
            { activateOnUpdate: true },
          );

          // 2) AMDP class (do NOT solo-activate — it activates with the group).
          await cls.create({
            className: amdpName,
            packageName,
            transportRequest,
            description: 'DSFI integration AMDP implementation',
          });
          const amdpLock = await cls.lock({ className: amdpName });
          await cls.update(
            { className: amdpName, transportRequest, sourceCode: amdpSource },
            { lockHandle: amdpLock },
          );
          await cls.unlock({ className: amdpName }, amdpLock);

          // 3) DSFI create + implementation update (PUT /source/main JSON).
          try {
            await dsfi.create({
              implementationName: implName,
              scalarFunctionName: funcName,
              engineValue: 'sqlEngine',
              packageName,
              transportRequest,
              description: 'DSFI integration implementation',
            });
          } catch (e) {
            if (isSkippable(e)) {
              logTestSkip(testsLogger, TEST_LABEL, 'DSFI unsupported here');
              await cleanup();
              return;
            }
            throw e;
          }
          await dsfi.update({
            implementationName: implName,
            sourceCode: implSource,
          });

          // 4) Group-activate the trio (synchronous).
          await client.getUtils().activateObjectsGroup([
            { type: 'DSFD/SCF', name: funcName },
            { type: 'CLAS/OC', name: amdpName },
            { type: 'DSFI/SFI', name: implName },
          ]);

          // 5) Read implementation source (JSON) — must contain the amdpReference.
          const readState = await dsfi.read(
            { implementationName: implName },
            'active',
          );
          expect(readState?.readResult).toBeDefined();
          const sourceText =
            typeof readState?.readResult?.data === 'string'
              ? readState.readResult.data
              : JSON.stringify(readState?.readResult?.data);
          expect(sourceText).toContain(`${amdpName}=>GET_SUM`);

          // 6) Read metadata (blues v2 XML).
          const metaState = await dsfi.readMetadata({
            implementationName: implName,
          });
          expect(metaState.metadataResult).toBeDefined();

          // 7) Delete the trio.
          const del = await dsfi.delete({
            implementationName: implName,
            transportRequest,
          });
          expect(del.deleteResult).toBeDefined();
          await cls.delete({ className: amdpName, transportRequest });
          await sf.delete({ scalarFunctionName: funcName, transportRequest });

          logTestSuccess(testsLogger, TEST_LABEL);
        } catch (error) {
          logTestError(testsLogger, TEST_LABEL, error);
          await cleanup();
          throw error;
        } finally {
          logTestEnd(testsLogger, TEST_LABEL);
        }
      },
      getTimeout('test'),
    );
  });
});
