/**
 * Integration test for AdtUnitTest
 * Tests using AdtClient for unit test operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - UnitTest library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=unitTest/UnitTest
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
import type { IUnitTestConfig } from '../../../../core/unitTest';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
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
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getTestCaseDefinition,
  getEnvironmentConfig,
  getTimeout,
  resolvePackageName,
  resolveTransportRequest,
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

describe('AdtUnitTest (using AdtClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;
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

  describe('Run unit test', () => {
    it(
      'should run unit test and get status/result',
      async () => {
        const testCase = getTestCaseDefinition(
          'run_unit_test',
          'adt_unit_test',
        );

        if (
          !TestConfigResolver.isTestAvailable(testCase, isCloudSystem, isLegacy)
        ) {
          logTestStart(testsLogger, 'UnitTest - run unit test', {
            name: 'run_unit_test',
            params: {},
          });
          const envName = isCloudSystem
            ? 'cloud'
            : isLegacy
              ? 'legacy'
              : 'onprem';
          logTestSkip(
            testsLogger,
            'UnitTest - run unit test',
            `Test not available for ${envName} environment`,
          );
          return;
        }

        if (!testCase?.params?.test_class?.run_unit_test) {
          logTestStart(testsLogger, 'UnitTest - run unit test', {
            name: 'run_unit_test',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'UnitTest - run unit test',
            'Unit test configuration not found in test-config.yaml',
          );
          return;
        }

        const containerClass = testCase.params.test_class.container_class;
        const testClassName = testCase.params.test_class.name;
        const packageName = resolvePackageName(testCase.params.package_name);
        const transportRequest = resolveTransportRequest(
          testCase.params.transport_request,
        );
        const sourceCode =
          testCase.params.source_code ||
          `CLASS ${containerClass} DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.`;
        const testClassSource =
          testCase.params.test_class_source ||
          `CLASS ${testClassName} DEFINITION FINAL FOR TESTING RISK LEVEL HARMLESS DURATION SHORT. PRIVATE SECTION. METHODS test_method FOR TESTING. ENDCLASS. CLASS ${testClassName} IMPLEMENTATION. METHOD test_method. ENDMETHOD. ENDCLASS.`;
        const unitTestOptions = testCase.params.unit_test_options || {};
        const unitTestStatus = testCase.params.unit_test_status || {};
        const unitTestResult = testCase.params.unit_test_result || {};
        const skipCleanup = testCase.params.skip_cleanup === true;

        logTestStart(testsLogger, 'UnitTest - run unit test', {
          name: 'run_unit_test',
          params: {
            container_class: containerClass,
            test_class: testClassName,
            package_name: packageName,
            unit_test_options: unitTestOptions,
          },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'UnitTest - run unit test',
            'No SAP configuration',
          );
          return;
        }

        if (!packageName) {
          logTestSkip(
            testsLogger,
            'UnitTest - run unit test',
            'Package name not configured',
          );
          return;
        }

        try {
          // Step 0: Check if class already exists
          let classExists = false;
          try {
            const existingClass = await client
              .getClass()
              .read({ className: containerClass });
            if (existingClass?.readResult) {
              classExists = true;
              testsLogger.info?.(
                `Class ${containerClass} already exists, will reuse`,
              );
            }
          } catch {
            testsLogger.info?.(
              `Class ${containerClass} does not exist, will create`,
            );
          }

          // Step 1-2: Validate and create (only if class doesn't exist)
          if (!classExists) {
            logTestStep('validate', testsLogger);
            const validateState = await client.getClass().validate({
              className: containerClass,
              packageName,
              sourceCode,
            });
            expect(validateState).toBeDefined();
            testsLogger.info?.('Container class validated');

            logTestStep('create', testsLogger);
            const createClassState = await client.getClass().create({
              className: containerClass,
              packageName,
              transportRequest,
              description: `Test container class for ${testClassName}`,
              sourceCode,
            });
            expect(createClassState).toBeDefined();
            testsLogger.info?.('Container class created');
          } else {
            // Update existing class source code
            testsLogger.info?.('Updating existing class source code');
            await client
              .getClass()
              .update(
                { className: containerClass, sourceCode, transportRequest },
                { sourceCode },
              );
            testsLogger.info?.('Existing class source updated');
          }

          // Step 3: Write the tests into the container class's include.
          // An include is not created — it exists because its class does.
          logTestStep('update (test class)', testsLogger);
          const writeTestClassState = await client.getLocalTestClass().update({
            className: containerClass,
            testClassCode: testClassSource,
            transportRequest,
          });
          expect(writeTestClassState).toBeDefined();
          testsLogger.info?.('Local test class written');

          // Step 4: Activate class
          logTestStep('activate', testsLogger);
          const activateState = await client.getClass().activate({
            className: containerClass,
            transportRequest,
          });
          expect(activateState).toBeDefined();
          testsLogger.info?.('Class activated');

          // Step 5: Read back the tests that were written into the class
          logTestStep('read (unit test)', testsLogger);
          const unitTest = client.getUnitTest();
          const readState = await unitTest.read(
            { className: containerClass },
            'active',
          );
          expect(readState).toBeDefined();
          expect(readState?.readResult).toBeDefined();
          testsLogger.info?.('Tests read back from the container class');

          const metadataState = await unitTest.readMetadata({
            className: containerClass,
          });
          expect(metadataState).toBeDefined();
          expect(metadataState.metadataResult).toBeDefined();

          // Step 6: Run the tests. Needs no create and no update — they are in
          // the class already, which is the whole point of the two being apart.
          logTestStep('run (unit test)', testsLogger);
          const runId = await unitTest.run(
            [{ containerClass, testClass: testClassName }],
            unitTestOptions,
          );
          expect(runId).toBeDefined();
          testsLogger.info?.('Unit test run started, run ID:', runId);

          // Step 7: Ask about the run — a different concern from running it,
          // and since interfaces 16.0.0 a different interface as well.
          logTestStep('getStatus (run)', testsLogger);
          const statusResponse = await unitTest.getStatus(
            runId,
            unitTestStatus.with_long_polling ?? true,
          );
          expect(statusResponse).toBeDefined();
          expect(statusResponse.data).toBeDefined();

          // Log detailed status information
          if (statusResponse.data) {
            const status = statusResponse.data;
            if (typeof status === 'string') {
              // Try to parse XML if it's a string
              try {
                const { XMLParser } = require('fast-xml-parser');
                const parser = new XMLParser({ ignoreAttributes: false });
                const parsed = parser.parse(status);
                const runStatus =
                  parsed?.['aunit:runStatus'] || parsed?.runStatus;
                if (runStatus) {
                  testsLogger.info?.(
                    'Unit test run status:',
                    JSON.stringify(runStatus, null, 2),
                  );
                } else {
                  testsLogger.info?.(
                    'Unit test status (raw):',
                    status.substring(0, 500),
                  );
                }
              } catch {
                testsLogger.info?.(
                  'Unit test status:',
                  status.substring(0, 500),
                );
              }
            } else {
              testsLogger.info?.(
                'Unit test run status:',
                JSON.stringify(status, null, 2),
              );
            }
          }

          // Step 8: Fetch the result document
          logTestStep('getResult (run)', testsLogger);
          const resultResponse = await unitTest.getResult(runId, {
            withNavigationUris: unitTestResult.with_navigation_uris || false,
            format: unitTestResult.format || 'abapunit',
          });
          expect(resultResponse).toBeDefined();
          expect(resultResponse.data).toBeDefined();

          // Log detailed result information
          if (resultResponse.data) {
            const result = resultResponse.data;
            if (typeof result === 'string') {
              // Try to parse XML if it's a string
              try {
                const { XMLParser } = require('fast-xml-parser');
                const parser = new XMLParser({ ignoreAttributes: false });
                const parsed = parser.parse(result);
                const runResult =
                  parsed?.['aunit:runResult'] || parsed?.runResult || parsed;
                if (runResult) {
                  testsLogger.info?.(
                    'Unit test run result:',
                    JSON.stringify(runResult, null, 2),
                  );
                } else {
                  testsLogger.info?.(
                    'Unit test result (raw):',
                    result.substring(0, 500),
                  );
                }
              } catch {
                testsLogger.info?.(
                  'Unit test result:',
                  result.substring(0, 500),
                );
              }
            } else {
              testsLogger.info?.(
                'Unit test run result:',
                JSON.stringify(result, null, 2),
              );
            }
          }

          // Step 10: Cleanup - delete class if configured
          if (!skipCleanup && containerClass) {
            try {
              logTestStep('delete (cleanup)', testsLogger);
              testsLogger.info?.('Cleaning up test class:', containerClass);
              await client.getClass().delete({
                className: containerClass,
                transportRequest,
              });
              testsLogger.info?.('Test class deleted successfully');
            } catch (cleanupError) {
              testsLogger.warn?.('Failed to cleanup test class:', cleanupError);
            }
          } else if (skipCleanup) {
            testsLogger.info?.(
              'Cleanup skipped - test class left for analysis',
            );
          }

          logTestSuccess(testsLogger, 'UnitTest - run unit test');
        } catch (error) {
          logTestError(testsLogger, 'UnitTest - run unit test', error);
          throw error;
        } finally {
          logTestEnd(testsLogger, 'UnitTest - run unit test');
        }
      },
      getTimeout('test'),
    );
  });
});
