/**
 * Unit test for ClassBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - ClassBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=class/ClassBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
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
  logBuilderTestError,
  logBuilderTestSkip,
  logBuilderTestStart,
  logBuilderTestSuccess,
  logBuilderTestEnd,
  logBuilderTestStep,
  setTotalTests,
  resetTestCounter
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
  getOperationDelay
} = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

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

describe('ClassBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    // Count total tests for progress tracking
    const testCount = 3; // Full workflow + Read standard object + Read transport request
    setTotalTests(testCount);
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);

      // Connect to SAP system to initialize session (get CSRF token and cookies)
      await (connection as any).connect();

      hasConfig = true;
      // Check if this is a cloud system
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      testsLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    resetTestCounter();
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
    try {
      const cleanupBuilder = new ClassBuilder(connection, builderLogger, {
        className,
        packageName,
        description: `Cleanup ${className}`
      });
      await cleanupBuilder.delete();
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

        let builder = new ClassBuilder(connection, builderLogger, {
          className: testClassName,
          packageName: testPackageName,
          description: `Test class ${testClassName}`,
          transportRequest: resolveTransportRequest(testCase.params.transport_request),
      }).setCode(sourceCode);
      if (testClassConfig?.source_code) {
        builder = builder.setTestClassCode(testClassConfig.source_code);
      }
      if (testClassConfig?.name) {
        builder = builder.setTestClassName(testClassConfig.name);
      }

      let unitTestBuilder: UnitTestBuilder | null = null;

      try {
        logBuilderTestStep('validate');
      await builder
        .validate()
        .then(b => {
            logBuilderTestStep('create');
          return b.create();
        })
        .then(async b => {
          const createDelay = getOperationDelay('create', testCase);
          await new Promise(resolve => setTimeout(resolve, createDelay));
          const classNameToCreate = testClassName;
          if (!classNameToCreate) {
            throw new Error('class_name is not defined');
          }
          await waitForClassCreation(classNameToCreate);
          logBuilderTestStep('lock');
          return b.lock();
        })
          .then(async b => {
            // Wait for SAP to commit lock operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
            logBuilderTestStep('check with source code (before update)');
            return b.check('inactive', sourceCode);
        })
        .then(b => {
            logBuilderTestStep('update');
          return b.update();
        })
          .then(async b => {
            // Wait for SAP to commit update operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
            logBuilderTestStep('check(inactive)');
            return b.check('inactive');
        })
          .then(b => {
            logBuilderTestStep('unlock');
            return b.unlock();
          })
          .then(async b => {
            // Wait for SAP to commit unlock operation
            await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
            logBuilderTestStep('activate');
            return b.activate();
          })
          .then(b => {
            logBuilderTestStep('check(active)');
            return b.check('active');
          })
          .then(async b => {
            if (!shouldUpdateTestClass) {
              return b;
            }

            unitTestBuilder = new UnitTestBuilder(connection, builderLogger, {
              objectType: 'class',
              objectName: testClassName!,
              testClassName: testClassConfig.name,
              transportRequest: resolveTransportRequest(testCase.params.transport_request)
            }).setTestClassSource(testClassConfig.source_code);

            logBuilderTestStep('lock test classes');
            await unitTestBuilder.lockTestClasses();

            logBuilderTestStep('update test classes');
            await unitTestBuilder.updateTestClass();

            logBuilderTestStep('unlock test classes');
            await unitTestBuilder.unlockTestClasses();

            await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
            logBuilderTestStep('activate test classes');
            await unitTestBuilder.activateTestClasses();

            return b;
          })
          .then(async b => {
            if (!shouldRunUnitTests || testDefinitions.length === 0) {
              return b;
            }

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
            await unitTestBuilder.runForClass(testDefinitions, runOptions);

            const runId = unitTestBuilder.getRunId();
            testsLogger.info?.('[ABAP-UNIT] Run started', { runId });

            logBuilderTestStep('get ABAP Unit test status');
            await unitTestBuilder.getStatus(
              testClassConfig.unit_test_status?.with_long_polling !== false
            );

            const runStatus = unitTestBuilder.getRunStatus();
            const statusText = typeof runStatus === 'string' ? runStatus : JSON.stringify(runStatus);
            testsLogger.info?.('[ABAP-UNIT] Status retrieved', { 
              runId, 
              status: statusText,
              finished: statusText.includes('FINISHED')
            });

            await new Promise(resolve => setTimeout(resolve, getOperationDelay('unit_test_result', testCase)));

            logBuilderTestStep('get ABAP Unit test result');
            await unitTestBuilder.getResult({
              withNavigationUris: testClassConfig.unit_test_result?.with_navigation_uris ?? false,
              format: testClassConfig.unit_test_result?.format === 'junit' ? 'junit' : 'abapunit'
            });

            const runResult = unitTestBuilder.getRunResult();
            const hasResult = runResult !== undefined && runResult !== null;
            testsLogger.info?.('[ABAP-UNIT] Result retrieved', { 
              runId, 
              hasResult,
              resultType: hasResult ? typeof runResult : 'undefined'
            });

            return b;
          })
          .then(b => {
            logBuilderTestStep('delete (cleanup)');
            return b.delete();
          });

        const state = builder.getState();
        expect(state.createResult).toBeDefined();
        expect(state.activateResult).toBeDefined();
        
        if (shouldUpdateTestClass) {
          expect(unitTestBuilder).toBeDefined();
          const unitTestState = unitTestBuilder!.getState();
          expect(unitTestState.testLockHandle).toBeUndefined(); // Should be unlocked after operations
        }
        
        if (shouldRunUnitTests) {
          expect(unitTestBuilder).toBeDefined();
          expect(unitTestBuilder!.getRunId()).toBeDefined();
          expect(unitTestBuilder!.getRunStatus()).toBeDefined();
          expect(unitTestBuilder!.getRunResult()).toBeDefined();
        }
        
        expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(testsLogger, 'ClassBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(testsLogger, 'ClassBuilder - full workflow', error);
        throw error;
      } finally {
        // Cleanup: force unlock in case of failure
        await builder.forceUnlock().catch(() => {});
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

      const builder = new ClassBuilder(
        connection,
        builderLogger,
        {
          className: standardClassName,
          packageName: 'SAP', // Standard package
          description: '' // Not used for read operations
        }
      );

      try {
        logBuilderTestStep('read');
        await builder.read('active');

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

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

      const builder = new ClassBuilder(
        connection,
        builderLogger,
        {
          className: standardClassName,
          packageName: 'SAP', // Standard package
          description: '' // Not used for read operations
        }
      );

      try {
        logBuilderTestStep('readTransport');
        await builder.readTransport();

        const result = builder.getTransportResult();
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
