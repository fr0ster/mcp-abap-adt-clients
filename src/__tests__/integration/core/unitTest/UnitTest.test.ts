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
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtClient } from '../../../../clients/AdtClient';
import type { IUnitTestConfig } from '../../../../core/unitTest';
import { getConfig } from '../../../helpers/sessionConfig';
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
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, libraryLogger);
      hasConfig = true;
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      (connection as any).reset();
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
          // Step 1: Validate container class
          logTestStep('validate', testsLogger);
          const validateState = await client.getClass().validate({
            className: containerClass,
            packageName,
            sourceCode,
          });
          expect(validateState).toBeDefined();
          testsLogger.info?.('Container class validated');

          // Step 2: Create container class
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

          // Step 3: Create local test class
          logTestStep('create (test class)', testsLogger);
          const createTestClassState = await client.getLocalTestClass().create({
            className: containerClass,
            testClassCode: testClassSource,
            testClassName,
            transportRequest,
          });
          expect(createTestClassState).toBeDefined();
          testsLogger.info?.('Local test class created');

          // Step 4: Activate class
          logTestStep('activate', testsLogger);
          const activateState = await client.getClass().activate({
            className: containerClass,
            transportRequest,
          });
          expect(activateState).toBeDefined();
          testsLogger.info?.('Class activated');

          // Step 5: Create unit test configuration
          logTestStep('create (unit test)', testsLogger);
          const unitTestConfig: IUnitTestConfig = {
            tests: [
              {
                containerClass,
                testClass: testClassName,
              },
            ],
            options: unitTestOptions,
          };
          testsLogger.info?.('Unit test configuration created');

          // Step 6: Update unit test (if needed - for now just prepare)
          // Note: Unit test runs don't have update step, but we log the preparation
          logTestStep('update (unit test)', testsLogger);
          testsLogger.info?.('Unit test configuration prepared');

          // Step 7: Run unit test (start test execution)
          logTestStep('run (unit test)', testsLogger);
          const unitTest = client.getUnitTest() as any;
          const runId = await unitTest.run(
            unitTestConfig.tests!,
            unitTestConfig.options,
          );
          expect(runId).toBeDefined();
          testsLogger.info?.('Unit test run started, run ID:', runId);

          // Step 8: Read status (with long polling if configured)
          logTestStep('read (status)', testsLogger);
          const readConfig: IUnitTestConfig = {
            runId: runId,
            status: unitTestStatus,
          };

          const readState = await client
            .getUnitTest()
            .read(readConfig, 'active');
          expect(readState).toBeDefined();
          expect(readState?.runId).toBe(runId);
          expect(readState?.runStatus).toBeDefined();

          const metadataState = await client
            .getUnitTest()
            .readMetadata(readConfig);
          expect(metadataState).toBeDefined();
          expect(metadataState.runId).toBe(runId);
          expect(metadataState.runStatus).toBeDefined();

          // Log detailed status information
          if (readState?.runStatus) {
            const status = readState.runStatus;
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

          // Step 9: Read result
          logTestStep('read (result)', testsLogger);
          const _resultConfig: IUnitTestConfig = {
            runId: runId,
            result: unitTestResult,
          };

          // Use getResult() method to explicitly read the test result
          // Note: getResult() is not part of IAdtObject interface, so we need to cast
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

          if (readState?.runResult) {
            testsLogger.info?.(
              'Unit test result from read state:',
              readState.runResult,
            );
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
