/**
 * Integration test for InterfaceBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - InterfaceBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=interface/InterfaceBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../../../clients/AdtClient';
import { getInterface } from '../../../core/interface/read';
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

// Library code (InterfaceBuilder) uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('InterfaceBuilder (using AdtClient)', () => {
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
    return getTestCaseDefinition('create_interface', 'adt_interface');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for InterfaceBuilder test');
    }
    return {
      interfaceName: params.interface_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description,
      sourceCode: params.source_code
    };
  }

  async function waitForInterfaceCreation(interfaceName: string, maxAttempts = 5, delayMs = 2000): Promise<void> {
    if (!connection) {
      return;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await getInterface(connection, interfaceName);
        if (process.env.DEBUG_ADT_TESTS === 'true') {
          console.log(`[waitForInterfaceCreation] Interface ${interfaceName} found on attempt ${attempt}`);
        }
        return;
      } catch (error: any) {
        if (error.response?.status !== 404) {
          throw error;
        }
        if (process.env.DEBUG_ADT_TESTS === 'true') {
          console.log(`[waitForInterfaceCreation] Interface ${interfaceName} not found yet (attempt ${attempt}/${maxAttempts})`);
        }
        if (attempt === maxAttempts) {
          throw new Error(`Interface ${interfaceName} was not created after ${maxAttempts} attempts (${maxAttempts * delayMs}ms total wait time)`);
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let interfaceName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      interfaceName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_interface', 'adt_interface');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'Interface - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      interfaceName = tc.params.interface_name;
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'Interface - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'Interface - full workflow', skipReason);
        return;
      }

      if (!testCase || !interfaceName) {
        logBuilderTestSkip(testsLogger, 'Interface - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);

      logBuilderTestStep('validate');
      const validationState = await client.getInterface().validate({
        interfaceName: config.interfaceName,
        packageName: config.packageName!,
        description: config.description || ''
      });
      const validationResponse = validationState?.validationResponse;
      if (validationResponse?.status !== 200) {
        const errorData = typeof validationResponse?.data === 'string' 
          ? validationResponse.data 
          : JSON.stringify(validationResponse?.data);
        console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
      }
      expect(validationResponse?.status).toBe(200);

      // Check cleanup settings: cleanup_after_test (global) and skip_cleanup (test-specific or global)
      const envConfig = getEnvironmentConfig();
      const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = testCase.params.skip_cleanup !== undefined
        ? testCase.params.skip_cleanup === true
        : globalSkipCleanup;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;

      let interfaceCreated = false;
      let currentStep = '';
      
      try {
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        const createState = await client.getInterface().create({
          interfaceName: config.interfaceName,
          packageName: config.packageName!,
          description: config.description || '',
          transportRequest: config.transportRequest
        }, { activateOnCreate: false, sourceCode: config.sourceCode });
        
        // Verify create was successful
        const createResult = createState?.createResult;
        if (!createResult) {
          throw new Error('Interface creation did not return a result');
        }
        if (createResult.status !== 201 && createResult.status !== 200) {
          const errorData = typeof createResult.data === 'string' 
            ? createResult.data 
            : JSON.stringify(createResult.data);
          console.error(`Create failed (HTTP ${createResult.status}): ${errorData}`);
          throw new Error(`Interface creation failed with status ${createResult.status}`);
        }
        
        interfaceCreated = true;
        
        if (process.env.DEBUG_ADT_TESTS === 'true') {
          console.log(`[InterfaceBuilder test] Create successful - Status: ${createResult.status}`);
        }
        
        // Wait for object to be ready using long polling
        try {
          await client.getInterface().read({ interfaceName: interfaceName! }, 'active', { withLongPolling: true });
        } catch (readError) {
          testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - check might still work
        }
        
        // Wait for interface to be available for lock
        await waitForInterfaceCreation(interfaceName!);

        currentStep = 'check before update';
        logBuilderTestStep(currentStep);
        const checkBeforeUpdateState = await client.getInterface().check({ 
          interfaceName: config.interfaceName,
          sourceCode: config.sourceCode
        }, 'inactive');
        const checkBeforeUpdate = checkBeforeUpdateState?.checkResult;
        expect(checkBeforeUpdate?.status).toBeDefined();

        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.getInterface().update({
          interfaceName: config.interfaceName
        }, { sourceCode: config.sourceCode });
        
        // Wait for object to be ready after update using long polling
        try {
          await client.getInterface().read({ interfaceName: config.interfaceName }, 'active', { withLongPolling: true });
        } catch (readError) {
          testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - check might still work
        }

        currentStep = 'check(inactive)';
        logBuilderTestStep(currentStep);
        const checkResultInactiveState = await client.getInterface().check({ interfaceName: config.interfaceName }, 'inactive');
        const checkResultInactive = checkResultInactiveState?.checkResult;
        expect(checkResultInactive?.status).toBeDefined();

        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await client.getInterface().activate({ interfaceName: config.interfaceName });
        // Wait for object to be ready after activation using long polling
        try {
          await client.getInterface().read({ interfaceName: config.interfaceName }, 'active', { withLongPolling: true });
        } catch (readError) {
          testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - check might still work
        }

        currentStep = 'check(active)';
        logBuilderTestStep(currentStep);
        // Retry check for active version - activation may take time
        const checkResultActiveState = await retryCheckAfterActivate(
          async () => {
            const state = await client.getInterface().check({ interfaceName: config.interfaceName }, 'active');
            return state?.checkResult;
          },
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.interfaceName
          }
        );
        expect(checkResultActiveState?.status).toBeDefined();

        if (shouldCleanup) {
          currentStep = 'delete (cleanup)';
          logBuilderTestStep(currentStep);
          await client.getInterface().delete({
            interfaceName: config.interfaceName,
            transportRequest: config.transportRequest
          });
        } else {
          testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - interface left for analysis: ${config.interfaceName}`);
        }

        logBuilderTestSuccess(testsLogger, 'Interface - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);
        
        // Cleanup: delete if object was created and cleanup is enabled
        if (shouldCleanup && interfaceCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getInterface().delete({
              interfaceName: config.interfaceName,
              transportRequest: config.transportRequest
            });
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.interfaceName}:`, cleanupError);
          }
        } else if (!shouldCleanup && interfaceCreated) {
          testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - interface left for analysis: ${config.interfaceName}`);
        }
        
        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'Interface - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'Interface - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP interface', async () => {
      const testCase = getTestCaseDefinition('create_interface', 'adt_interface');
      const standardObject = resolveStandardObject('interface', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'InterfaceBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'InterfaceBuilder - read standard object',
          `Standard interface not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardInterfaceName = standardObject.name;
      logBuilderTestStart(testsLogger, 'InterfaceBuilder - read standard object', {
        name: 'read_standard',
        params: { interface_name: standardInterfaceName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'InterfaceBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const resultState = await client.getInterface().read({ interfaceName: standardInterfaceName });
        expect(resultState).toBeDefined();
        expect(resultState?.readResult).toBeDefined();
        // Interface read returns interface config - check if interfaceName is present
        const interfaceConfig = resultState?.readResult;
        if (interfaceConfig && typeof interfaceConfig === 'object' && 'interfaceName' in interfaceConfig) {
          expect((interfaceConfig as any).interfaceName).toBe(standardInterfaceName);
        }

        logBuilderTestSuccess(testsLogger, 'InterfaceBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'InterfaceBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'InterfaceBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

