/**
 * Integration test for AdtCdsUnitTest
 * Tests using AdtClient for CDS unit test operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - CdsUnitTest library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=unitTest/CdsUnitTest
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type {
  ICdsUnitTestConfig,
  IUnitTestConfig,
} from '../../../../core/unitTest';
import { checkCdsTestDoublesAvailability } from '../../../../core/unitTest/checkCdsTestDoublesAvailability';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
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
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  getEnvironmentConfig,
  getTimeout,
  ensureSharedPackage,
  ensureSharedDependency,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code uses DEBUG_ADT_LIBS
const libraryLogger: ILogger = createLibraryLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('AdtCdsUnitTest (using AdtClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isLegacy = false;
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      const isCloudSystem = await isCloudEnvironment(connection);
      systemContext = await resolveSystemContext(connection, isCloudSystem);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;

      await ensureSharedPackage(client, testsLogger);
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  describe('Create CDS unit test class', () => {
    it(
      'should create CDS unit test class with template and test class source',
      async () => {
        const testCase = getTestCaseDefinition(
          'create_cds_unit_test',
          'cds_unit_test',
        );
        if (!testCase?.params?.cds_unit_test) {
          logTestStart(
            testsLogger,
            'CdsUnitTest - create CDS unit test class',
            {
              name: 'create_cds_unit_test',
              params: {},
            },
          );
          logTestSkip(
            testsLogger,
            'CdsUnitTest - create CDS unit test class',
            'CDS unit test configuration not found in test-config.yaml',
          );
          return;
        }

        const packageName = resolvePackageName(testCase.params.package_name);
        if (!packageName) {
          logTestStart(
            testsLogger,
            'CdsUnitTest - create CDS unit test class',
            {
              name: 'create_cds_unit_test',
              params: {},
            },
          );
          logTestSkip(
            testsLogger,
            'CdsUnitTest - create CDS unit test class',
            'Package name not configured',
          );
          return;
        }

        const cdsUnitTestConfig = testCase.params.cds_unit_test;
        const className = cdsUnitTestConfig.class_name;
        const testClassName = cdsUnitTestConfig.test_class_name;
        const ddlName = testCase.params.ddl_name;
        const classTemplate = cdsUnitTestConfig.template_xml;
        const testClassSource = cdsUnitTestConfig.test_class_source;
        const transportRequest = resolveTransportRequest(
          cdsUnitTestConfig.transport_request ||
            testCase.params.transport_request,
        );

        // Name the parameter that is actually absent. Listing all five joined
        // by "or" says only that one of them is missing, which sent me looking
        // in the wrong place twice: `ddl_name` alone was gone (the config had
        // drifted to `view_name`), while the message implicated the four that
        // were present.
        const missingParams = Object.entries({
          'cds_unit_test.class_name': className,
          'cds_unit_test.test_class_name': testClassName,
          ddl_name: ddlName,
          'cds_unit_test.template_xml': classTemplate,
          'cds_unit_test.test_class_source': testClassSource,
        })
          .filter(([, value]) => !value)
          .map(([key]) => key);

        if (missingParams.length > 0) {
          logTestStart(
            testsLogger,
            'CdsUnitTest - create CDS unit test class',
            {
              name: 'create_cds_unit_test',
              params: {},
            },
          );
          logTestSkip(
            testsLogger,
            'CdsUnitTest - create CDS unit test class',
            `Missing in test-config.yaml under create_cds_unit_test: ${missingParams.join(', ')}`,
          );
          return;
        }

        logTestStart(testsLogger, 'CdsUnitTest - create CDS unit test class', {
          name: 'create_cds_unit_test',
          params: {
            class_name: className,
            test_class_name: testClassName,
            ddl_name: ddlName,
            package_name: packageName,
          },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'CdsUnitTest - create CDS unit test class',
            'No SAP configuration',
          );
          return;
        }

        const depTableName = testCase.params.dep_table_name;

        try {
          // Ensure shared dependencies exist (created once, never deleted)
          if (depTableName) {
            await ensureSharedDependency(
              client,
              'tables',
              depTableName,
              testsLogger,
            );
          }

          if (ddlName) {
            const viewResult = await ensureSharedDependency(
              client,
              'views',
              ddlName,
              testsLogger,
            );

            // Wait for CDS metadata to propagate only when view was newly created
            if (viewResult.created) {
              testsLogger.info?.(
                'Waiting for CDS metadata to propagate after view creation...',
              );
              await new Promise((resolve) => setTimeout(resolve, 10000));
            }
          }

          // Delete existing test class if it exists (idempotent test)
          try {
            await client.getClass().delete({
              className,
              transportRequest,
            });
            testsLogger.info?.(
              'Deleted existing CDS unit test class:',
              className,
            );
          } catch {
            // Class doesn't exist — continue
          }

          // Step 1: Check CDS view availability for unit test doubles
          if (ddlName) {
            logTestStep('checkCdsTestDoubles', testsLogger);
            testsLogger.info?.(
              'Checking CDS view for unit test doubles:',
              ddlName,
            );
            const checkResponse = await checkCdsTestDoublesAvailability(
              connection,
              ddlName,
            );
            expect(checkResponse).toBeDefined();
            expect(checkResponse.status).toBe(200);
            testsLogger.info?.('CDS view check passed');
          }

          // Step 2: Create CDS unit test class
          logTestStep('create', testsLogger);
          const cdsUnitTestConfigForCreate: ICdsUnitTestConfig = {
            className,
            packageName,
            cdsViewName: ddlName,
            classTemplate,
            testClassSource,
            description:
              cdsUnitTestConfig.description || `CDS unit test for ${ddlName}`,
            transportRequest,
          };

          const createState = expectResult(
            await client.getCdsUnitTest().create(cdsUnitTestConfigForCreate),
            'createState',
          );
          expect(createState).toBeDefined();
          expect(createState).toBeDefined();
          testsLogger.info?.('CDS unit test class created successfully');

          // Step 3: Activate class
          logTestStep('activate', testsLogger);
          const activateState = await client.getClass().activate({
            className,
            transportRequest,
          });
          expect(activateState).toBeDefined();
          testsLogger.info?.('CDS unit test class activated');

          // Step 4: Read the created test class
          logTestStep('read', testsLogger);
          const readState = expectResult(
            await client.getClass().read({ className }),
            'readState',
          );
          expect(readState).toBeDefined();
          expect(readState).toBeDefined();
          testsLogger.info?.('CDS unit test class read successfully');
          const metadataState = expectResult(
            await client.getClass().readMetadata({ className }),
            'metadataState',
          );
          expect(metadataState).toBeDefined();
          expect(metadataState).toBeDefined();
          testsLogger.info?.('CDS unit test class metadata read successfully');

          // Step 5: Run the tests the generated class holds. No create and no
          // update first — running is its own capability.
          logTestStep('run (unit test)', testsLogger);
          const unitTest = client.getUnitTest();
          const runId = await unitTest.run(
            [{ containerClass: className, testClass: testClassName }],
            testCase.params.unit_test_options || {},
          );
          expect(runId).toBeDefined();
          testsLogger.info?.('CDS unit test run started, run ID:', runId);

          // Step 6: Ask about the run — its own interface since 16.0.0
          logTestStep('getStatus (run)', testsLogger);
          const statusResponse = expectResult(
            await unitTest.getStatus(
              runId,
              testCase.params.unit_test_status?.with_long_polling ?? true,
            ),
            'statusResponse',
          );
          expect(statusResponse).toBeDefined();
          expect(statusResponse).toBeDefined();
          testsLogger.info?.('CDS unit test status retrieved');

          // Step 7: Fetch the result document
          logTestStep('getResult (run)', testsLogger);
          const resultResponse = expectResult(
            await unitTest.getResult(runId, {
              withNavigationUris:
                testCase.params.unit_test_result?.with_navigation_uris || false,
              format: testCase.params.unit_test_result?.format || 'abapunit',
            }),
            'resultResponse',
          );
          expect(resultResponse).toBeDefined();
          expect(resultResponse).toBeDefined();
          testsLogger.info?.('CDS unit test result retrieved successfully');

          // Step 10: Cleanup
          const envConfig = getEnvironmentConfig();
          const skipCleanup =
            testCase.params.skip_cleanup === true ||
            envConfig.skip_cleanup === true;

          if (!skipCleanup) {
            // Cleanup test class (shared dependencies are never deleted)
            if (className) {
              try {
                logTestStep('delete (cleanup)', testsLogger);
                testsLogger.info?.(
                  'Cleaning up CDS unit test class:',
                  className,
                );
                await client.getClass().delete({
                  className,
                  transportRequest,
                });
                testsLogger.info?.('CDS unit test class deleted successfully');
              } catch (cleanupError: any) {
                testsLogger.warn?.(
                  `Failed to cleanup CDS unit test class: ${cleanupError.message}`,
                );
              }
            }
          } else {
            testsLogger.info?.('Cleanup skipped - objects left for analysis');
          }

          logTestSuccess(
            testsLogger,
            'CdsUnitTest - create CDS unit test class',
          );
        } catch (error) {
          logTestError(
            testsLogger,
            'CdsUnitTest - create CDS unit test class',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'CdsUnitTest - create CDS unit test class');
        }
      },
      getTimeout('test'),
    );
  });
});
