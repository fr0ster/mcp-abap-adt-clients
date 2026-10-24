/**
 * Integration test for group activation
 * Tests activating multiple related objects (domain, data element, structure) in a single group activation
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - library logs
 *  DEBUG_CONNECTORS=true   - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=shared/groupActivation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
// The source path, not the package: this reading is new in adt-strategies and
// the package's built entry point does not carry it until it is released.
import {
  analyseDeletion,
  analyseUnsupportedStatus,
  utilActivationRunId,
} from '@mcp-abap-adt/adt-strategies';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { activationStatusIn } from '../../../../scripts/lib/activationRun';
import type { AdtClient } from '../../../clients/AdtClient';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { integrationHeadersOf } from '../../helpers/adtHeaders';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../helpers/caseGate';
import { CleanupSteps } from '../../helpers/cleanupSteps';
import { expectResult, releasing } from '../../helpers/contract';
import { expectLockReleased } from '../../helpers/lockReleased';
import { expectRemovedOrAbsent } from '../../helpers/objectPresence';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../helpers/testProgressLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  getTimeout,
  getOperationDelay,
  getEnvironmentConfig,
} = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const _libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('Group Activation (Shared)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
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
        testsLogger,
        systemContext,
      );
      client = resolvedClient;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  function getTestDefinition() {
    return configuredCase('group_activation', 'adt_group_activation');
  }

  describe('Group activation workflow', () => {
    let testCase: any = null;
    let domainName: string | null = null;
    let dataElementName: string | null = null;
    let structureName: string | null = null;
    let setupError: string | null = null;
    let domainCreated = false;
    let dataElementCreated = false;
    let structureCreated = false;

    beforeAll(async () => {
      setupError = null;
      testCase = null;
      domainName = null;
      dataElementName = null;
      structureName = null;
      domainCreated = false;
      dataElementCreated = false;
      structureCreated = false;

      // The gate registered the test, so the case is configured, enabled and
      // available here; a case that is not there is a defect, not a skip.
      const tc = getTestDefinition();
      if (!tc) {
        setupError = missingCaseMessage(
          'group_activation',
          'adt_group_activation',
        );
        return;
      }

      const packageCheck = ensurePackageConfig(
        tc.params,
        'Group Activation - full workflow',
      );
      if (!packageCheck.success) {
        setupError = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      domainName = tc.params.domain_name;
      dataElementName = tc.params.data_element_name;
      structureName = tc.params.structure_name;
    });

    afterAll(async () => {
      // Cleanup: delete objects in reverse order (structure -> data element -> domain)
      const transportRequest = resolveTransportRequest(
        testCase?.params?.transport_request,
      );

      // Check cleanup settings: cleanup_after_test (global) and skip_cleanup (test-specific or global)
      const envConfig = getEnvironmentConfig();
      const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup =
        testCase?.params?.skip_cleanup !== undefined
          ? testCase?.params?.skip_cleanup === true
          : globalSkipCleanup;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;

      if (!shouldCleanup) {
        testsLogger.info?.(
          '⚠️ Cleanup skipped (cleanup_after_test=false or skip_cleanup=true)',
        );
        return;
      }

      // Every delete runs whatever the one before answered, and a refused one
      // fails the suite once all have run: an object this test created and
      // could not remove is what the next run's create meets.
      const steps = new CleanupSteps();
      const pause = () =>
        new Promise((resolve) =>
          setTimeout(resolve, getOperationDelay('delete', testCase) || 3000),
        );
      if (structureCreated && structureName) {
        logTestStep('cleanup: delete structure', testsLogger);
        await steps.run(
          `delete structure ${structureName}`,
          () =>
            client.getStructure().delete(
              { structureName: structureName!, transportRequest },
              {
                headers: integrationHeadersOf(client.getStructure(), 'delete'),
                analyse: analyseDeletion,
              },
            ),
          { checkAnswer: true },
        );
        await pause();
      }

      if (dataElementCreated && dataElementName) {
        logTestStep('cleanup: delete data element', testsLogger);
        await steps.run(
          `delete data element ${dataElementName}`,
          () =>
            client.getDataElement().delete(
              { dataElementName: dataElementName!, transportRequest },
              {
                headers: integrationHeadersOf(
                  client.getDataElement(),
                  'delete',
                ),
                analyse: analyseDeletion,
              },
            ),
          { checkAnswer: true },
        );
        await pause();
      }

      if (domainCreated && domainName) {
        logTestStep('cleanup: delete domain', testsLogger);
        await steps.run(
          `delete domain ${domainName}`,
          () =>
            client.getDomain().delete(
              { domainName: domainName!, transportRequest },
              {
                headers: integrationHeadersOf(client.getDomain(), 'delete'),
                analyse: analyseDeletion,
              },
            ),
          { checkAnswer: true },
        );
        await pause();
      }
      steps.finish();
    });

    gate('group_activation', 'adt_group_activation')(
      'should create domain, data element, structure and activate them as a group',
      async () => {
        const definition = getTestDefinition();
        logTestStart(
          testsLogger,
          'Group Activation - full workflow',
          definition,
        );

        if (setupError) {
          throw new Error(
            `Test could not be set up: ${setupError}. Nothing was verified.`,
          );
        }

        if (!testCase || !domainName || !dataElementName || !structureName) {
          throw new Error(
            'domain_name, data_element_name and structure_name must be configured',
          );
        }

        const packageName = resolvePackageName(testCase.params.package_name);
        if (!packageName) throw new Error('package_name not configured');

        const transportRequest = resolveTransportRequest(
          testCase.params.transport_request,
        );

        let currentStep = '';

        // Pre-cleanup: delete leftover objects from failed previous runs
        // Shared objects are not this test's to remove.
        const isSharedName = (label: string) =>
          (label === 'data element' ? dataElementName : domainName)?.startsWith(
            'ZAC_SHR_',
          ) ?? false;

        for (const [label, deleteFn] of [
          [
            'structure',
            () =>
              client.getStructure().delete(
                { structureName: structureName!, transportRequest },
                {
                  headers: integrationHeadersOf(
                    client.getStructure(),
                    'delete',
                  ),
                  analyse: analyseDeletion,
                },
              ),
          ],
          [
            'data element',
            () =>
              client.getDataElement().delete(
                { dataElementName: dataElementName!, transportRequest },
                {
                  headers: integrationHeadersOf(
                    client.getDataElement(),
                    'delete',
                  ),
                  analyse: analyseDeletion,
                },
              ),
          ],
          [
            'domain',
            () =>
              client.getDomain().delete(
                { domainName: domainName!, transportRequest },
                {
                  headers: integrationHeadersOf(client.getDomain(), 'delete'),
                  analyse: analyseDeletion,
                },
              ),
          ],
        ] as const) {
          if (label !== 'structure' && isSharedName(label)) {
            continue;
          }
          // Absence is the expected answer; removed is fine too. Any other
          // refusal fails here, naming what SAP said, rather than showing up
          // three steps later as `409 Conflict` on the create, which says
          // nothing about why.
          //
          // Order matters and is not interchangeable: the structure references
          // the data element, which references the domain, so they come apart
          // in exactly this sequence. Removing the data element first leaves a
          // dangling reference and the delete is refused.
          const removed = expectRemovedOrAbsent(
            await deleteFn(),
            `pre-cleanup: delete leftover ${label}`,
          );
          testsLogger.info?.(`Pre-cleanup: leftover ${label} ${removed}`);
        }

        // Objects taken from shared_dependencies are created once by
        // `npm run shared:setup` and owned by it. This test neither creates nor
        // deletes them — it only builds the structure on top. Rebuilding the whole
        // chain every run is what left a structure pointing at a data element a
        // failed run had already removed.
        const isShared = (name: string | null) =>
          !!name?.startsWith('ZAC_SHR_');

        // A name validation answers in its document, and a leftover of an
        // earlier run is what it reports as "already exists". The one refusal
        // accepted is a system with no validation resource (404/405/501), read
        // as `UNSUPPORTED_OPERATION`: it has not judged the name, and the create
        // that follows does. Any other refusal fails with what SAP said.
        const expectNameFree = (
          answer: IAdtResponse<unknown>,
          label: string,
          name: string,
        ): void => {
          if (
            !answer.ok &&
            answer.getError().code === AdtObjectErrorCodes.UNSUPPORTED_OPERATION
          ) {
            testsLogger.warn?.(
              `⚠️ ${label} validation unavailable: ${answer.getError().message}`,
            );
            return;
          }
          const document = String(
            expectResult(answer, `validate ${label}`) ?? '',
          );
          if (/already exists|does already exist/i.test(document)) {
            throw new Error(
              `${label} ${name} already exists: delete it before the run`,
            );
          }
        };
        const validation = {
          analyse: analyseUnsupportedStatus([404, 405, 501], 'name validation'),
        };

        try {
          // Step 0: Validate domain
          currentStep = 'validate domain';
          logTestStep(currentStep, testsLogger);
          expectNameFree(
            await client.getDomain().validate(
              {
                domainName: domainName,
                packageName: packageName,
                description:
                  testCase.params.description ||
                  `Test domain for group activation`,
              },
              validation,
            ),
            'Domain',
            domainName,
          );

          // Step 1: Create domain — unless it is a shared object
          currentStep = 'create domain';
          if (isShared(domainName)) {
            testsLogger.info?.(
              `Using shared domain ${domainName} — not creating`,
            );
          } else {
            logTestStep(currentStep, testsLogger);
            expectResult(
              await client.getDomain().create(
                {
                  domainName: domainName,
                  packageName: packageName,
                  description:
                    testCase.params.description ||
                    `Test domain for group activation`,
                  transportRequest: transportRequest,
                },
                { headers: integrationHeadersOf(client.getDomain(), 'create') },
              ),
              'create domain',
            );
            domainCreated = true;
            await new Promise((resolve) =>
              setTimeout(resolve, getOperationDelay('create', testCase)),
            );

            // Step 1.5: Validate data element
            currentStep = 'validate data element';
            logTestStep(currentStep, testsLogger);
            expectNameFree(
              await client.getDataElement().validate(
                {
                  dataElementName: dataElementName,
                  packageName: packageName,
                  description:
                    testCase.params.description ||
                    `Test data element for group activation`,
                },
                validation,
              ),
              'Data element',
              dataElementName,
            );
          }

          // Step 2: Create data element — unless it is a shared object
          currentStep = 'create data element';
          if (isShared(dataElementName)) {
            testsLogger.info?.(
              `Using shared data element ${dataElementName} — not creating`,
            );
          } else {
            logTestStep(currentStep, testsLogger);
            expectResult(
              await client.getDataElement().create(
                {
                  dataElementName: dataElementName,
                  packageName: packageName,
                  description:
                    testCase.params.description ||
                    `Test data element for group activation`,
                  typeKind: testCase.params.data_element_type_kind || 'domain',
                  transportRequest: transportRequest,
                },
                {
                  headers: integrationHeadersOf(
                    client.getDataElement(),
                    'create',
                  ),
                },
              ),
              'create data element',
            );
            dataElementCreated = true;
            await new Promise((resolve) =>
              setTimeout(resolve, getOperationDelay('create', testCase)),
            );

            // Step 2.5: Validate structure
            currentStep = 'validate structure';
            logTestStep(currentStep, testsLogger);
            expectNameFree(
              await client.getStructure().validate(
                {
                  structureName: structureName,
                  description:
                    testCase.params.description ||
                    `Test structure for group activation`,
                },
                validation,
              ),
              'Structure',
              structureName,
            );
          }

          // Step 3: Create structure based on data element
          currentStep = 'create structure';
          logTestStep(currentStep, testsLogger);
          // Use provided DDL code or generate one with data element reference
          const structureDdlCode =
            testCase.params.structure_ddl_code ||
            `@EndUserText.label: 'Group activation test structure'
@AbapCatalog.enhancement.category: #NOT_EXTENSIBLE
define structure ${structureName} {
 mandt : abap.clnt;
 test_field : ${dataElementName};
}`;
          expectResult(
            await client.getStructure().create(
              {
                structureName: structureName,
                packageName: packageName,
                description:
                  testCase.params.description ||
                  `Test structure for group activation`,
                transportRequest: transportRequest,
              },
              {
                headers: integrationHeadersOf(client.getStructure(), 'create'),
              },
            ),
            'create structure',
          );
          structureCreated = true;
          await new Promise((resolve) =>
            setTimeout(resolve, getOperationDelay('create', testCase)),
          );

          // Step 3.5: Update structure with DDL code (low-level: skip check since deps not yet activated)
          currentStep = 'update structure';
          logTestStep(currentStep, testsLogger);
          const structureHandler = client.getStructure();
          // Narrowed once here: the closures below do not keep the narrowing.
          const updatedStructure: string = structureName;
          const structureLockHandle = expectResult(
            await structureHandler.lock({ structureName }),
            'lock structure',
          );
          await releasing(
            async () =>
              expectResult(
                await structureHandler.update(
                  {
                    structureName: updatedStructure,
                    source: structureDdlCode,
                    transportRequest: transportRequest,
                  },
                  {
                    headers: integrationHeadersOf(structureHandler, 'update'),
                    lockHandle: structureLockHandle,
                  },
                ),
                'update structure',
              ),
            () =>
              structureHandler.unlock(
                { structureName: updatedStructure },
                structureLockHandle,
              ),
            'unlock structure',
          );
          await expectLockReleased(
            (c) => c.getStructure(),
            { structureName },
            `structure ${structureName}`,
            testsLogger,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, getOperationDelay('update', testCase)),
          );

          // Step 4: Group activation - activate all objects together
          currentStep = 'group activation';
          logTestStep(currentStep, testsLogger);
          const objectsToActivate = [
            { type: 'DOMA', name: domainName },
            { type: 'DTEL', name: dataElementName },
            { type: 'TABL/DS', name: structureName },
          ];

          // Step 4: start the run, wait for it, read what it produced.
          //
          // Three calls since 19.0.0, because they are three requests. A run id
          // on its own is not success: it says the server accepted the work, and
          // the results document is what says how the work went. A fixed sleep in
          // its place was a guess about someone else's system.
          // The run id is `utilActivationRunId`'s reading of `Location`; the
          // shipped default answers the POST as it came.
          const utils = client.getUtils({
            ...utilDocuments,
            activation: utilActivationRunId,
          });
          const runId = expectResult(
            await utils.activateObjectsGroup(objectsToActivate, false, {
              headers: integrationHeadersOf(utils, 'activateObjectsGroup'),
            }),
            'activation run id',
          );
          expect(runId).toBeTruthy();

          // The wait is this test's. `activateObjectsGroup` is the POST, read
          // here into the run id; `finished` is what this test needs, and `error`
          // or `failed` is what it must not accept as one.
          let runStatus = '';
          const runDeadline = Date.now() + 120_000;
          while (runStatus !== 'finished' && Date.now() < runDeadline) {
            const run = expectResult(
              await utils.getActivationRun(runId, { withLongPolling: true }),
              'activation run status',
            );
            runStatus = activationStatusIn(String(run));
            if (runStatus === 'error' || runStatus === 'failed') {
              throw new Error(`activation run ${runId} ended as ${runStatus}`);
            }
          }
          expect(runStatus).toBe('finished');

          const results = expectResult(
            await utils.getActivationResults(runId),
            'activation results',
          );
          // A finished run is not an activation that happened: the results
          // say that. `activationExecuted="true"` beside an error message is
          // still a failure — the object stays inactive — read as
          // `activateSharedGroup` reads it.
          const resultsDocument = String(results ?? '');
          const activationErrors = [
            ...resultsDocument.matchAll(
              /<msg\b[^>]*type="E"[^>]*>[\s\S]*?<txt>([^<]*)<\/txt>/g,
            ),
          ].map((m) => m[1]);
          if (
            !/activationExecuted="true"/.test(resultsDocument) ||
            activationErrors.length > 0
          ) {
            throw new Error(
              `group activation run ${runId} did not activate: ${
                activationErrors.join('; ') || resultsDocument.slice(0, 600)
              }`,
            );
          }
          testsLogger.info?.(
            `✅ run ${runId} finished; results: ${resultsDocument.slice(0, 120)}`,
          );

          logTestSuccess(testsLogger, 'Group Activation - full workflow');
        } catch (error: any) {
          logTestError(testsLogger, 'Group Activation - full workflow', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Group Activation - full workflow');
        }
      },
      120000,
    ); // 2 minute timeout
  });
});
