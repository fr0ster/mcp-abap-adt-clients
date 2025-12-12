/**
 * Integration test for ClassBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ClassBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=class/ClassBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import type { IClassUnitTestDefinition, IClassUnitTestRunOptions } from '../../../core/unitTest/types';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { getConfig } from '../../helpers/sessionConfig';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep,
  logBuilderTestStepError,
  getHttpStatusText
} from '../../helpers/builderTestLogger';
import { createConnectionLogger, createBuilderLogger, createTestsLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolveStandardObject,
  getTimeout,
  getOperationDelay,
  retryCheckAfterActivate,
  getEnvironmentConfig
} = require('../../helpers/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (ClassBuilder) uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('ClassBuilder (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new AdtClient(connection, builderLogger);
      hasConfig = true;
      // Check if this is a cloud system
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      testsLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_class', 'adt_class');
  }

  /**
   * Ensure class is ready for test (delete if exists)
   * Uses validateClassName to check existence
   */
  /**
   * Pre-check: Verify test class doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   */
  async function ensureClassReady(className: string, packageName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if class exists
    try {
      const cleanupClient = new AdtClient(connection, builderLogger);
      const existingClass = await cleanupClient.getClass().read({ className });
      if (existingClass) {
        // Class exists - try to delete it
        try {
          await cleanupClient.getClass().delete({
            className,
            transportRequest: resolveTransportRequest(undefined)
          });
          // Give backend time to finalize deletion
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (cleanupError: any) {
          return {
            success: false,
            reason: `Failed to delete existing class ${className}: ${cleanupError.message || cleanupError}`
          };
        }
      }
    } catch (error: any) {
      // 404 is expected - object doesn't exist, we can proceed
      if (error.response?.status !== 404) {
        return {
          success: false,
          reason: `Cannot verify class existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }


  function buildUnitTestDefinitions(config: any, fallbackClassName: string): IClassUnitTestDefinition[] {
    if (!config) {
      return [];
    }

    const entries = Array.isArray(config.tests) && config.tests.length
      ? config.tests
      : [{
        container_class: config.container_class || fallbackClassName,
        test_class: config.name || config.test_class
      }];

    return entries
      .map((entry: any) => ({
        containerClass: entry.container_class || entry.containerClass || fallbackClassName,
        testClass: entry.test_class || entry.testClass || entry.name || config.name || 'LTCL_TEST_CLASS'
      }))
      .filter((item: IClassUnitTestDefinition) => Boolean(item.containerClass) && Boolean(item.testClass));
  }

  function normalizeUnitTestOptions(raw?: any): IClassUnitTestRunOptions | undefined {
    if (!raw) {
      return undefined;
    }

    const options: IClassUnitTestRunOptions = {};
    if (raw.title) {
      options.title = raw.title;
    }
    if (raw.context) {
      options.context = raw.context;
    }

    if (raw.scope) {
      options.scope = {
        ownTests: raw.scope.own_tests ?? raw.scope.ownTests,
        foreignTests: raw.scope.foreign_tests ?? raw.scope.foreignTests,
        addForeignTestsAsPreview: raw.scope.add_foreign_tests_as_preview ?? raw.scope.addForeignTestsAsPreview
      };
    }

    const riskSource = raw.risk_level || raw.riskLevel;
    if (riskSource) {
      options.riskLevel = {
        harmless: riskSource.harmless,
        dangerous: riskSource.dangerous,
        critical: riskSource.critical
      };
    }

    if (raw.duration) {
      options.duration = {
        short: raw.duration.short,
        medium: raw.duration.medium,
        long: raw.duration.long
      };
    }

    return options;
  }

  function extractRunIdFromResponse(response: { headers?: Record<string, any> }): string | null {
    if (!response?.headers) {
      return null;
    }

    const headerNames = ['location', 'content-location', 'sap-adt-location'];
    for (const header of headerNames) {
      const value = response.headers[header] || response.headers[header.toUpperCase()];
      if (typeof value === 'string' && value.length > 0) {
        const runId = value.split('/').pop();
        if (runId) {
          return runId;
        }
      }
    }
    return null;
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let testClassName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      testClassName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_class', 'adt_class');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'Class - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      testClassName = tc.params.class_name;

      // Cleanup before test
      if (testClassName) {
        const packageName = resolvePackageName(tc.params.package_name);
        const cleanup = await ensureClassReady(testClassName, packageName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup class before test';
          testCase = null;
          testClassName = null;
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'Class - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'Class - full workflow', skipReason);
        return;
      }

      if (!testCase || !testClassName) {
        logBuilderTestSkip(testsLogger, 'Class - full workflow', skipReason || 'Test case not available');
        return;
      }

      const testPackageName = resolvePackageName(testCase.params.package_name);
      if (!testPackageName) {
        logBuilderTestSkip(testsLogger, 'Class - full workflow', 'package_name not configured');
        return;
      }
      // Check cleanup settings: cleanup_after_test (global) and skip_cleanup (test-specific or global)
      const envConfig = getEnvironmentConfig();
      const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = testCase.params.skip_cleanup !== undefined
        ? testCase.params.skip_cleanup === true
        : globalSkipCleanup;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;
      const sourceCode = testCase.params.source_code || `CLASS ${testClassName} DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.`;
      const testClassConfig = testCase.params.test_class;
      const shouldUpdateTestClass = Boolean(
        testClassConfig &&
        testClassConfig.enabled !== false &&
        testClassConfig.source_code
      );
      let testClassUpdateSucceeded = false; // Track if test class was successfully updated
      const shouldRunUnitTests = Boolean(
        shouldUpdateTestClass &&
        (testClassConfig.run_unit_test === undefined || testClassConfig.run_unit_test === true)
      );
      const testDefinitions = shouldRunUnitTests
        ? buildUnitTestDefinitions(testClassConfig, testClassName)
        : [];

      // Declare cleanup tracking variables at outer scope so they're accessible in finally block
      let classCreated = false;
      let currentStep = '';

      try {
        logBuilderTestStep('validate');
        const validationState = await client.getClass().validate({
          className: testClassName,
          packageName: testPackageName,
          description: `Test class ${testClassName}`
        });
        const validationResponse = validationState?.validationResponse;
        if (validationResponse?.status !== 200) {
          const errorData = typeof validationResponse?.data === 'string'
            ? validationResponse.data
            : JSON.stringify(validationResponse?.data);
          console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
        }
        expect(validationResponse?.status).toBe(200);

        try {
          currentStep = 'create';
          logBuilderTestStep(currentStep);
          await client.getClass().create({
            className: testClassName,
            packageName: testPackageName,
            description: `Test class ${testClassName}`,
            transportRequest: resolveTransportRequest(testCase.params.transport_request)
          }, { activateOnCreate: false });
          classCreated = true;
          // Wait for object to be ready using long polling
          try {
            await client.getClass().read({ className: testClassName! }, 'active', { withLongPolling: true });
          } catch (readError) {
            testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
            // Continue anyway - check might still work
          }

          currentStep = 'check with source code (before update)';
          logBuilderTestStep(currentStep);
          const checkBeforeUpdateState = await client.getClass().check({ 
            className: testClassName!,
            sourceCode: sourceCode
          }, 'inactive');
          const checkBeforeUpdate = checkBeforeUpdateState?.checkResult;
          expect(checkBeforeUpdate?.status).toBeDefined();

          // Verify check response - if status is not 200, there might be errors
          if (checkBeforeUpdate?.status !== 200) {
            const errorData = typeof checkBeforeUpdate?.data === 'string'
              ? checkBeforeUpdate.data
              : JSON.stringify(checkBeforeUpdate?.data);
            throw new Error(`Check failed with status ${checkBeforeUpdate?.status}: ${errorData}`);
          }

          currentStep = 'update';
          logBuilderTestStep(currentStep);
          await client.getClass().update({
            className: testClassName
          }, { sourceCode: sourceCode });
          // Wait for object to be ready after update using long polling
          try {
            await client.getClass().read({ className: testClassName }, 'active', { withLongPolling: true });
          } catch (readError) {
            testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
            // Continue anyway - check might still work
          }

          currentStep = 'check(inactive)';
          logBuilderTestStep(currentStep);
          const checkResultInactiveState = await client.getClass().check({ className: testClassName }, 'inactive');
          const checkResultInactive = checkResultInactiveState?.checkResult;
          expect(checkResultInactive?.status).toBeDefined();

          currentStep = 'activate';
          logBuilderTestStep(currentStep);
          await client.getClass().activate({ className: testClassName });
          // Wait for object to be ready after activation using long polling
          try {
            await client.getClass().read({ className: testClassName }, 'active', { withLongPolling: true });
          } catch (readError) {
            testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
            // Continue anyway - check might still work
          }

          currentStep = 'check(active)';
          logBuilderTestStep(currentStep);
          // Retry check for active version - activation may take time
          const checkResultActiveState = await retryCheckAfterActivate(
            async () => {
              const state = await client.getClass().check({ className: testClassName! }, 'active');
              return state?.checkResult;
            },
            {
              maxAttempts: 5,
              delay: 1000,
              logger: testsLogger,
              objectName: testClassName!
            }
          );
          expect(checkResultActiveState?.status).toBeDefined();
          // Test class operations (if enabled) - using AdtClient (test classes are local classes, not unit test runs)
          if (shouldUpdateTestClass) {
            currentStep = 'check test class before update';
            logBuilderTestStep(currentStep);
            try {
              await client.getLocalTestClass().check({ 
                className: testClassName!, 
                testClassCode: testClassConfig.source_code 
              }, 'inactive');

              currentStep = 'update test classes';
              logBuilderTestStep(currentStep);
              await client.getLocalTestClass().update({
                className: testClassName!,
                testClassCode: testClassConfig.source_code
              });

              currentStep = 'activate test classes';
              logBuilderTestStep(currentStep);
              await client.getLocalTestClass().activate({
                className: testClassName!
              });
              
              testClassUpdateSucceeded = true; // Mark test class update as successful
            } catch (checkError: any) {
              testsLogger.error?.('❌ Test class code is incorrect - check failed!');
              testsLogger.error?.('Test class validation errors:', checkError.message);
              // testClassUpdateSucceeded remains false - will skip unit tests
            }
          }

          // Unit test operations (if enabled and test class was successfully updated)
          if (shouldRunUnitTests && testClassUpdateSucceeded && testDefinitions.length > 0) {
            logBuilderTestStep('run ABAP Unit tests');
            testsLogger.info?.('[ABAP-UNIT] Starting run', {
              tests: testDefinitions.map(test => `${test.containerClass}/${test.testClass}`).join(', ')
            });
            const runOptions = normalizeUnitTestOptions(testClassConfig.unit_test_options);
            const unitTest = client.getUnitTest() as any; // AdtUnitTest has convenience methods beyond IAdtObject
            const runId = await unitTest.run(testDefinitions, runOptions);

            if (!runId) {
              throw new Error('Unit test run ID not available');
            }
            testsLogger.info?.('[ABAP-UNIT] Run started', { runId });

            logBuilderTestStep('get ABAP Unit test status');
            await unitTest.getStatus(
              runId,
              testClassConfig.unit_test_status?.with_long_polling !== false
            );

            const runStatus = unitTest.getStatusResponse();
            // Safely serialize AxiosResponse - extract only needed fields to avoid circular references
            const statusText = runStatus
              ? `${runStatus.status} ${runStatus.statusText || ''} ${typeof runStatus.data === 'string' ? runStatus.data : JSON.stringify(runStatus.data || {})}`
              : 'No status available';
            testsLogger.info?.('[ABAP-UNIT] Status retrieved', {
              runId,
              status: runStatus?.status,
              statusText: runStatus?.statusText,
              finished: statusText.includes('FINISHED')
            });

            await new Promise(resolve => setTimeout(resolve, getOperationDelay('unit_test_result', testCase)));

            logBuilderTestStep('get ABAP Unit test result');
            await unitTest.getResult(runId, {
              withNavigationUris: testClassConfig.unit_test_result?.with_navigation_uris ?? false,
              format: testClassConfig.unit_test_result?.format === 'junit' ? 'junit' : 'abapunit'
            });

            const runResult = unitTest.getResultResponse();
            const hasResult = runResult !== undefined && runResult !== null;
            // Safely extract result data without circular references
            const resultData = runResult?.data;
            testsLogger.info?.('[ABAP-UNIT] Result retrieved', {
              runId,
              hasResult,
              status: runResult?.status,
              statusText: runResult?.statusText,
              resultDataType: hasResult ? typeof resultData : 'undefined'
            });
          }

          if (shouldCleanup) {
            currentStep = 'delete (cleanup)';
            logBuilderTestStep(currentStep);
            await client.getClass().delete({
              className: testClassName!,
              transportRequest: resolveTransportRequest(testCase.params.transport_request)
            });
          } else {
            testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - class left for analysis:`, testClassName);
          }

          // Note: AdtClient doesn't store results in state like CrudClient
          // Results are returned directly from methods

          // Only check unit test results if test class was successfully updated and tests ran
          if (shouldRunUnitTests && testClassUpdateSucceeded) {
            const unitTest = client.getUnitTest() as any; // AdtUnitTest has convenience methods beyond IAdtObject
            expect(unitTest.getRunId()).toBeDefined();
            expect(unitTest.getStatusResponse()).toBeDefined();
            expect(unitTest.getResultResponse()).toBeDefined();
          }

          logBuilderTestSuccess(testsLogger, 'Class - full workflow');
        } catch (error: any) {
          // Log step error with details before failing test
          logBuilderTestStepError(currentStep || 'unknown', error);

          // Cleanup: delete if cleanup is enabled
          // Note: AdtClient automatically handles unlock in update() method, so we only need to delete
          if (shouldCleanup && classCreated) {
            try {
              logBuilderTestStep('delete (cleanup)');
              await client.getClass().delete({
                className: testClassName!,
                transportRequest: resolveTransportRequest(testCase.params.transport_request)
              });
            } catch (cleanupError) {
              testsLogger.warn?.(`Cleanup failed for ${testClassName}:`, cleanupError);
            }
          } else if (!shouldCleanup && classCreated) {
            testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - class left for analysis:`, testClassName);
          }

          const statusText = getHttpStatusText(error);
          const enhancedError = statusText !== 'HTTP ?'
            ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
            : error;
          logBuilderTestError(testsLogger, 'Class - full workflow', enhancedError);
          throw enhancedError;
        }
      } finally {
        logBuilderTestEnd(testsLogger, 'Class - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP class', async () => {
      const testCase = getTestCaseDefinition('create_class', 'adt_class');
      const standardObject = resolveStandardObject('class', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'Class - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'Class - read standard object',
          `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardClassName = standardObject.name;
      logBuilderTestStart(testsLogger, 'Class - read standard object', {
        name: 'read_standard',
        params: { class_name: standardClassName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'Class - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const result = await client.getClass().read({ className: standardClassName });
        expect(result).toBeDefined();
        // IClassState doesn't have className directly, check readResult
        expect(result?.readResult).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'Class - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'Class - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'Class - read standard object');
      }
    }, getTimeout('test'));
  });

  describe('Read transport request', () => {
    it('should read transport request for class', async () => {
      const testCase = getTestCaseDefinition('create_class', 'adt_class');
      const standardObject = resolveStandardObject('class', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'ClassBuilder - read transport request', {
          name: 'read_transport',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'ClassBuilder - read transport request',
          `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardClassName = standardObject.name;

      // Check if transport_request is configured in YAML
      const transportRequest = resolveTransportRequest(testCase?.params?.transport_request);
      if (!transportRequest) {
        logBuilderTestStart(testsLogger, 'ClassBuilder - read transport request', {
          name: 'read_transport',
          params: { class_name: standardClassName }
        });
        logBuilderTestSkip(testsLogger, 'ClassBuilder - read transport request',
          'transport_request not configured in test-config.yaml (required for transport read test)');
        return;
      }

      logBuilderTestStart(testsLogger, 'ClassBuilder - read transport request', {
        name: 'read_transport',
        params: { class_name: standardClassName, transport_request: transportRequest }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'ClassBuilder - read transport request', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('readTransport');

        const result = await client.getRequest().read({ transportNumber: transportRequest });
        expect(result).toBeDefined();
        expect(result?.transportNumber || result?.readResult?.data?.transport_request).toBe(transportRequest);

        logBuilderTestSuccess(testsLogger, 'ClassBuilder - read transport request');
      } catch (error) {
        logBuilderTestError(testsLogger, 'ClassBuilder - read transport request', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'ClassBuilder - read transport request');
      }
    }, getTimeout('test'));
  });
});
