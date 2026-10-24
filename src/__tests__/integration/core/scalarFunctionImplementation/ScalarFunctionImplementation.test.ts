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
 * Whether DSFD/DSFI exists on a system is the configuration's to say — the case's
 * `enabled` / `available_in`, read by the registration gate — never inferred
 * from an answer: an enabled case whose create is refused, 404/405/501
 * included, fails with what SAP said.
 *
 * Run: npm test -- --testPathPatterns=scalarFunctionImplementation/ScalarFunctionImplementation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseActivation,
  analyseDeletion,
  analyseException,
  utilActivationRunId,
} from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { activationStatusIn } from '../../../../../scripts/lib/activationRun';
import type { AdtClient } from '../../../../clients/AdtClient';
import { utilDocuments } from '../../../../core/shared/utilResultSet';
import { orThrow } from '../../../../utils/adtResponse';
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
  releasing,
  saysAbsent,
} from '../../../helpers/contract';
import { judged } from '../../../helpers/judged';
import { expectLockReleased } from '../../../helpers/lockReleased';
import {
  createTestAdtClient,
  createTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { expectActivationExecuted } from '../../../helpers/sharedActivation';
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

describe('ScalarFunctionImplementation (DSFI/SFI) integration', () => {
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
    gate(
      'create_scalar_function_implementation',
      'adt_scalar_function_implementation',
    )(
      'DSFD + AMDP + DSFI fixture: create → impl update → group-activate → read → updateMetadata → delete',
      async () => {
        const TEST_LABEL = 'ScalarFunctionImplementation - full workflow';

        const testCase = configuredCase(
          'create_scalar_function_implementation',
          'adt_scalar_function_implementation',
        );
        if (!testCase) {
          throw new Error(
            missingCaseMessage(
              'create_scalar_function_implementation',
              'adt_scalar_function_implementation',
            ),
          );
        }
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

        if (!packageName) {
          throw new Error(
            'package_name not configured — set environment.default_package',
          );
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

        // Idempotent cleanup (impl → amdp → func) of any leftovers. Every
        // step runs; absent is what each wants, and any other refusal is
        // returned, named, for the caller to fail on.
        const cleanup = async (): Promise<string[]> => {
          const refusals: string[] = [];
          const remove = async (
            what: string,
            call: () => Promise<IAdtResponse<unknown>>,
          ) => {
            try {
              const answer = await call();
              if (!answer.ok && !saysAbsent(answer.getError())) {
                refusals.push(failureOf(answer, what));
              }
            } catch (error) {
              refusals.push(
                `${what} threw: ${error instanceof Error ? error.message : String(error)}`,
              );
            }
          };
          await remove(`delete DSFI ${implName}`, () =>
            dsfi.delete(
              {
                implementationName: implName,
                transportRequest,
              },
              {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(dsfi, 'delete'),
              },
            ),
          );
          await remove(`delete AMDP class ${amdpName}`, () =>
            cls.delete(
              { className: amdpName },
              {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(cls, 'delete'),
              },
            ),
          );
          await remove(`delete scalar function ${funcName}`, () =>
            sf.delete(
              { scalarFunctionName: funcName, transportRequest },
              {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(sf, 'delete'),
              },
            ),
          );
          return refusals;
        };
        const leftovers = await cleanup();
        if (leftovers.length > 0) {
          throw new Error(
            `leftovers of an earlier run could not be removed: ${leftovers.join('; ')}`,
          );
        }

        try {
          // 1) DSFD signature + activate (a definition activates standalone).
          // A refused create fails with what SAP said, 404/405/501 included:
          // whether DSFD/DSFI is there is the case's `enabled` /
          // `available_in`, not an answer to read it from.
          const funcCreated = await sf.create(
            {
              scalarFunctionName: funcName,
              packageName,
              transportRequest,
              description: 'DSFI integration companion function',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(sf, 'create'),
            },
          );
          expectResult(funcCreated, 'create scalar function');
          const funcLock = expectResult(
            await sf.lock(
              { scalarFunctionName: funcName },
              { analyse: analyseException },
            ),
            'lock scalar function',
          );
          await releasing(
            async () =>
              expectResult(
                await sf.update(
                  { scalarFunctionName: funcName, transportRequest },
                  {
                    analyse: analyseException,
                    headers: integrationHeadersOf(sf, 'update'),
                    source: sigSource,
                    lockHandle: funcLock,
                  },
                ),
                'update scalar function',
              ),
            () =>
              sf.unlock({ scalarFunctionName: funcName }, funcLock, {
                analyse: analyseException,
              }),
            'unlock scalar function',
          );
          await expectLockReleased(
            (c) => c.getScalarFunction(),
            { scalarFunctionName: funcName },
            `scalar function ${funcName}`,
            testsLogger,
          );
          expectResult(
            await sf.activate(
              { scalarFunctionName: funcName },
              {
                analyse: judged(analyseActivation),
                headers: integrationHeadersOf(sf, 'activate'),
              },
            ),
            'activate scalar function',
          );

          // 2) AMDP class (do NOT solo-activate — it activates with the group).
          expectResult(
            await cls.create(
              {
                className: amdpName,
                packageName,
                transportRequest,
                description: 'DSFI integration AMDP implementation',
              },
              {
                analyse: analyseException,
                headers: integrationHeadersOf(cls, 'create'),
              },
            ),
            'create AMDP class',
          );
          const amdpLock = expectResult(
            await cls.lock(
              { className: amdpName },
              { analyse: analyseException },
            ),
            'lock AMDP class',
          );
          await releasing(
            async () =>
              expectResult(
                await cls.update(
                  { className: amdpName, transportRequest },
                  {
                    analyse: analyseException,
                    headers: integrationHeadersOf(cls, 'update'),
                    source: amdpSource,
                    lockHandle: amdpLock,
                  },
                ),
                'update AMDP class',
              ),
            () =>
              cls.unlock({ className: amdpName }, amdpLock, {
                analyse: analyseException,
              }),
            'unlock AMDP class',
          );
          await expectLockReleased(
            (c) => c.getClass(),
            { className: amdpName },
            `AMDP class ${amdpName}`,
            testsLogger,
          );

          // 3) DSFI create + implementation update (PUT /source/main JSON).
          const implCreated = await dsfi.create(
            {
              implementationName: implName,
              scalarFunctionName: funcName,
              engineValue: 'sqlEngine',
              packageName,
              transportRequest,
              description: 'DSFI integration implementation',
            },
            {
              analyse: analyseException,
              headers: integrationHeadersOf(dsfi, 'create'),
            },
          );
          expectResult(implCreated, 'create DSFI');
          // Under its own lock, and its answer read. Without the handle the
          // PUT went out unlocked, ADT did not object audibly, and the source
          // simply did not change — the run failed three steps later on a
          // read-back that had no `=>GET_SUM` in it. Two lessons in one call:
          // the window is the caller's, and an unread answer is an unasked
          // question.
          const implLock = expectResult(
            await dsfi.lock(
              { implementationName: implName },
              { analyse: analyseException },
            ),
            'lock DSFI',
          );
          await releasing(
            async () =>
              expectResult(
                await dsfi.update(
                  { implementationName: implName, transportRequest },
                  {
                    analyse: analyseException,
                    headers: integrationHeadersOf(dsfi, 'update'),
                    source: implSource,
                    lockHandle: implLock,
                  },
                ),
                'update DSFI source',
              ),
            () =>
              dsfi.unlock({ implementationName: implName }, implLock, {
                analyse: analyseException,
              }),
            'unlock DSFI',
          );
          await expectLockReleased(
            (c) => c.getScalarFunctionImplementation(),
            { implementationName: implName },
            `scalar function implementation ${implName}`,
            testsLogger,
          );

          // 4) Group-activate the trio, then wait: step 5 reads the active
          // source, and reading it straight after the POST would read whatever
          // was there before. The run id is `utilActivationRunId`'s reading of
          // `Location`; the shipped default answers the POST as it came.
          const utils = client.getUtils({
            ...utilDocuments,
            activation: utilActivationRunId,
          });
          const runId = expectResult(
            await utils.activateObjectsGroup(
              [
                { type: 'DSFD/SCF', name: funcName },
                { type: 'CLAS/OC', name: amdpName },
                { type: 'DSFI/SFI', name: implName },
              ],
              undefined,
              {
                analyse: analyseException,
                headers: integrationHeadersOf(utils, 'activateObjectsGroup'),
              },
            ),
            'activation run id',
          );
          // The wait is this caller's. `activateObjectsGroup` is the POST and
          // answers the run id; how long to allow, and what a failure costs, are
          // decisions about this test.
          let runStatus = '';
          const runDeadline = Date.now() + 120_000;
          while (runStatus !== 'finished' && Date.now() < runDeadline) {
            const run = expectResult(
              await utils.getActivationRun(runId, {
                analyse: analyseException,
                withLongPolling: true,
              }),
              'activation run status',
            );
            runStatus = activationStatusIn(String(run));
            if (runStatus === 'error' || runStatus === 'failed') {
              throw new Error(`activation run ${runId} ended as ${runStatus}`);
            }
          }
          if (runStatus !== 'finished') {
            throw new Error(
              `activation run ${runId} had not finished at the deadline`,
            );
          }
          // A finished run is not an activation that happened: the results
          // say that (activationExecuted, and no message of type E).
          expectActivationExecuted(
            String(
              expectResult(
                await utils.getActivationResults(runId, {
                  analyse: analyseException,
                }),
                'activation results',
              ) ?? '',
            ),
            `group activation run ${runId}`,
          );

          // 5) Read implementation source (JSON) — must contain the amdpReference.
          // The DSFI source resource answers JSON, which the transport parses
          // on the way in — so the shipped reading re-serialises it rather than
          // stringifying an object into `[object Object]`.
          const sourceText = expectResult(
            await dsfi.read({ implementationName: implName }, 'active', {
              analyse: analyseException,
            }),
            'read implementation source',
          );
          expect(sourceText).toContain(`${amdpName}=>GET_SUM`);

          // 6) Read metadata (blues v2 XML).
          const metaState = expectResult(
            await dsfi.readMetadata(
              {
                implementationName: implName,
              },
              { analyse: analyseException },
            ),
            'metaState',
          );
          expect(metaState).toBeDefined();

          // 7) Delete the trio.
          const del = expectResult(
            await dsfi.delete(
              {
                implementationName: implName,
                transportRequest,
              },
              {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(dsfi, 'delete'),
              },
            ),
            'del',
          );
          expect(del).toBeDefined();
          expectResult(
            await cls.delete(
              { className: amdpName, transportRequest },
              {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(cls, 'delete'),
              },
            ),
            'delete AMDP class',
          );
          expectResult(
            await sf.delete(
              { scalarFunctionName: funcName, transportRequest },
              {
                analyse: judged(analyseDeletion),
                headers: integrationHeadersOf(sf, 'delete'),
              },
            ),
            'delete scalar function',
          );

          logTestSuccess(testsLogger, TEST_LABEL);
        } catch (error) {
          logTestError(testsLogger, TEST_LABEL, error);
          // The test already failed; a refused cleanup is added to that
          // failure, not dropped.
          const left = await cleanup();
          if (left.length > 0 && error instanceof Error) {
            error.message = `${error.message}; then ${left.join('; ')}`;
          }
          throw error;
        } finally {
          logTestEnd(testsLogger, TEST_LABEL);
        }
      },
      getTimeout('test'),
    );
  });
});
