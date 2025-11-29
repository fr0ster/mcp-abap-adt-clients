/**
 * Integration test for ClassBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ClassBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=class/ClassBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { CrudClient } from '../../../clients/CrudClient';
import { ClassBuilder } from '../../../core/class';
import {
  UnitTestBuilder,
  ClassUnitTestDefinition,
  ClassUnitTestRunOptions
} from '../../../core/unitTest';
import { IAdtLogger } from '../../../utils/logger';
import { getClass } from '../../../core/class/read';
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
  retryCheckAfterActivate
} = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Connection logs use DEBUG_CONNECTORS (from @mcp-abap-adt/connection)
const connectionLogger: ILogger = createConnectionLogger();

// Library code (ClassBuilder) uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('ClassBuilder (using CrudClient)', () => {
  let connection: AbapConnection;
  let client: CrudClient;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      client = new CrudClient(connection);
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
    return getTestCaseDefinition('create_class', 'builder_class');
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
      await getClass(connection, className);
      // Class exists - try to delete it
    try {
        const cleanupClient = new CrudClient(connection);
        await cleanupClient.deleteClass({
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

async function waitForClassCreation(className: string, maxAttempts = 5, delayMs = 2000): Promise<void> {
  if (!connection) {
    return;
  }

  // Use getClass (source endpoint) - it's more reliable than metadata endpoint
  // Metadata endpoint may return 406 for newly created classes
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await getClass(connection, className);
      return;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        throw error;
      }
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}

function buildUnitTestDefinitions(config: any, fallbackClassName: string): ClassUnitTestDefinition[] {
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
    .filter((item: ClassUnitTestDefinition) => Boolean(item.containerClass) && Boolean(item.testClass));
}

function normalizeUnitTestOptions(raw?: any): ClassUnitTestRunOptions | undefined {
  if (!raw) {
    return undefined;
  }

  const options: ClassUnitTestRunOptions = {};
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

      const tc = getEnabledTestCase('create_class', 'builder_class');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'ClassBuilder - full workflow');
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
      logBuilderTestStart(testsLogger, 'ClassBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'ClassBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !testClassName) {
        logBuilderTestSkip(testsLogger, 'ClassBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const testPackageName = resolvePackageName(testCase.params.package_name);
      if (!testPackageName) {
        logBuilderTestSkip(testsLogger, 'ClassBuilder - full workflow', 'package_name not configured');
        return;
      }
      const sourceCode = testCase.params.source_code || `CLASS ${testClassName} DEFINITION PUBLIC FINAL CREATE PUBLIC. ENDCLASS.`;
      const testClassConfig = testCase.params.test_class;
      const shouldUpdateTestClass = Boolean(
        testClassConfig &&
        testClassConfig.enabled !== false &&
        testClassConfig.source_code
      );
      const shouldRunUnitTests = Boolean(
        shouldUpdateTestClass &&
        (testClassConfig.run_unit_test === undefined || testClassConfig.run_unit_test === true)
      );
      const testDefinitions = shouldRunUnitTests
        ? buildUnitTestDefinitions(testClassConfig, testClassName)
        : [];

      let unitTestBuilder: UnitTestBuilder | null = null;

      try {
        logBuilderTestStep('validate');
        const validationResponse = await client.validateClass({
          className: testClassName,
          packageName: testPackageName,
          description: `Test class ${testClassName}`
        });
        if (validationResponse?.status !== 200) {
          const errorData = typeof validationResponse?.data === 'string' 
            ? validationResponse.data 
            : JSON.stringify(validationResponse?.data);
          console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
        }
        expect(validationResponse?.status).toBe(200);
        
        let classCreated = false;
        let classLocked = false;
        let testClassesLocked = false;
        let currentStep = '';
        
        try {
          currentStep = 'create';
          logBuilderTestStep(currentStep);
          await client.createClass({
            className: testClassName,
            packageName: testPackageName,
            description: `Test class ${testClassName}`,
            transportRequest: resolveTransportRequest(testCase.params.transport_request)
          });
          classCreated = true;
          const createDelay = getOperationDelay('create', testCase);
          await new Promise(resolve => setTimeout(resolve, createDelay));
          await waitForClassCreation(testClassName);
          
          currentStep = 'lock';
          logBuilderTestStep(currentStep);
          await client.lockClass({ className: testClassName });
          classLocked = true;
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
          
          currentStep = 'check with source code (before update)';
          logBuilderTestStep(currentStep);
          const checkBeforeUpdate = await client.checkClass({ className: testClassName! }, 'inactive', sourceCode);
          expect(checkBeforeUpdate?.status).toBeDefined();
          
          currentStep = 'update';
          logBuilderTestStep(currentStep);
          await client.updateClass({
            className: testClassName,
            sourceCode: sourceCode
          });
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
          currentStep = 'check(inactive)';
          logBuilderTestStep(currentStep);
          const checkResultInactive = await client.checkClass({ className: testClassName }, 'inactive');
          expect(checkResultInactive?.status).toBeDefined();
          
          currentStep = 'unlock';
          logBuilderTestStep(currentStep);
          await client.unlockClass({ className: testClassName });
          classLocked = false; // Unlocked successfully
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
          
          currentStep = 'activate';
          logBuilderTestStep(currentStep);
          await client.activateClass({ className: testClassName });
          // Wait for activation to complete (activation is asynchronous)
          await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
          
          currentStep = 'check(active)';
          logBuilderTestStep(currentStep);
          // Retry check for active version - activation may take time
          const checkResultActive = await retryCheckAfterActivate(
            () => client.checkClass({ className: testClassName! }, 'active'),
            {
              maxAttempts: 5,
              delay: 1000,
              logger: testsLogger,
              objectName: testClassName!
            }
          );
          expect(checkResultActive?.status).toBeDefined();
          // Test class operations (if enabled)
          if (shouldUpdateTestClass) {
            currentStep = 'lock test classes';
            logBuilderTestStep(currentStep);
            await client.lockTestClasses({ className: testClassName! });
            testClassesLocked = true;

            currentStep = 'update test classes';
            logBuilderTestStep(currentStep);
            await client.updateClassTestIncludes({
              className: testClassName!,
              testClassCode: testClassConfig.source_code
            });

            currentStep = 'unlock test classes';
            logBuilderTestStep(currentStep);
            await client.unlockTestClasses({ className: testClassName! });
            testClassesLocked = false; // Unlocked successfully
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));

            currentStep = 'activate test classes';
            logBuilderTestStep(currentStep);
            await client.activateTestClasses({
              className: testClassName!,
              testClassName: testClassConfig.name
            });
          }
        
        // Unit test operations (if enabled)
        if (shouldRunUnitTests && testDefinitions.length > 0) {
            if (!unitTestBuilder) {
              unitTestBuilder = new UnitTestBuilder(connection, builderLogger, {
                objectType: 'class',
                objectName: testClassName!
              });
            }

            logBuilderTestStep('run ABAP Unit tests');
            testsLogger.info?.('[ABAP-UNIT] Starting run', {
              tests: testDefinitions.map(test => `${test.containerClass}/${test.testClass}`).join(', ')
            });
            const runOptions = normalizeUnitTestOptions(testClassConfig.unit_test_options);
          await client.runClassUnitTests(testDefinitions, runOptions);

          const runId = client.getAbapUnitRunId();
          if (!runId) {
            throw new Error('Unit test run ID not available');
          }
            testsLogger.info?.('[ABAP-UNIT] Run started', { runId });

            logBuilderTestStep('get ABAP Unit test status');
          await client.getClassUnitTestRunStatus(
            runId,
              testClassConfig.unit_test_status?.with_long_polling !== false
            );

          const runStatus = client.getAbapUnitStatusResponse();
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
          await client.getClassUnitTestRunResult(runId, {
              withNavigationUris: testClassConfig.unit_test_result?.with_navigation_uris ?? false,
              format: testClassConfig.unit_test_result?.format === 'junit' ? 'junit' : 'abapunit'
            });

          const runResult = client.getAbapUnitResultResponse();
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

          currentStep = 'delete (cleanup)';
          logBuilderTestStep(currentStep);
          await client.deleteClass({
            className: testClassName!,
            transportRequest: resolveTransportRequest(testCase.params.transport_request)
          });

          expect(client.getCreateResult()).toBeDefined();
          expect(client.getActivateResult()).toBeDefined();
          
          if (shouldUpdateTestClass) {
            expect(client.getTestClassLockHandle()).toBeUndefined(); // Should be unlocked after operations
          }
          
          if (shouldRunUnitTests) {
            expect(client.getAbapUnitRunId()).toBeDefined();
            expect(client.getAbapUnitStatusResponse()).toBeDefined();
            expect(client.getAbapUnitResultResponse()).toBeDefined();
          }

          logBuilderTestSuccess(testsLogger, 'ClassBuilder - full workflow');
        } catch (error: any) {
          // Log step error with details before failing test
          logBuilderTestStepError(currentStep || 'unknown', error);
          
          // Cleanup: unlock and delete if object was created/locked
          if (testClassesLocked || classLocked || classCreated) {
            try {
              if (testClassesLocked) {
                logBuilderTestStep('unlock test classes (cleanup)');
                await client.unlockTestClasses({ className: testClassName! });
              }
              if (classLocked) {
                logBuilderTestStep('unlock (cleanup)');
                await client.unlockClass({ className: testClassName! });
              }
              if (classCreated) {
                logBuilderTestStep('delete (cleanup)');
                await client.deleteClass({
                  className: testClassName!,
                  transportRequest: resolveTransportRequest(testCase.params.transport_request)
                });
              }
            } catch (cleanupError) {
              // Log cleanup error but don't fail test - original error is more important
              testsLogger.warn?.(`Cleanup failed for ${testClassName}:`, cleanupError);
            }
          }
          
          const statusText = getHttpStatusText(error);
          const enhancedError = statusText !== 'HTTP ?'
            ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
            : error;
          logBuilderTestError(testsLogger, 'ClassBuilder - full workflow', enhancedError);
          throw enhancedError;
        }
      } finally {
        logBuilderTestEnd(testsLogger, 'ClassBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP class', async () => {
      const testCase = getTestCaseDefinition('create_class', 'builder_class');
      const standardObject = resolveStandardObject('class', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'ClassBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(testsLogger, 'ClassBuilder - read standard object',
          `Standard class not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`);
        return;
      }

      const standardClassName = standardObject.name;
      logBuilderTestStart(testsLogger, 'ClassBuilder - read standard object', {
        name: 'read_standard',
        params: { class_name: standardClassName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'ClassBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const result = await client.readClass(standardClassName);
        expect(result).toBeDefined();
        expect(result?.className).toBe(standardClassName);

        logBuilderTestSuccess(testsLogger, 'ClassBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'ClassBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'ClassBuilder - read standard object');
      }
    }, getTimeout('test'));
  });

  describe('Read transport request', () => {
    it('should read transport request for class', async () => {
      const testCase = getTestCaseDefinition('create_class', 'builder_class');
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
        await client.readTransport(transportRequest);

        const result = client.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

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
