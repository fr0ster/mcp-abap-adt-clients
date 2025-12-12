/**
 * Integration test for FunctionGroupBuilder
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - FunctionGroupBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=functionGroup/FunctionGroupBuilder
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
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
import { hasCheckErrorsFromResponse, getCheckErrorMessages } from '../../helpers/checkResultHelper';
import { parseCheckRunResponse } from '../../../utils/checkRun';
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

// Library code uses DEBUG_ADT_LIBS
const builderLogger: ILogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: ILogger = createTestsLogger();

describe('FunctionGroupBuilder (using AdtClient)', () => {
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
    return getTestCaseDefinition('create_function_group', 'adt_function_group');
  }

  function buildBuilderConfig(testCase: any) {
    const params = testCase?.params || {};
    const packageName = resolvePackageName(params.package_name);
    if (!packageName) {
      throw new Error('package_name not configured for FunctionGroupBuilder test');
    }
    return {
      functionGroupName: params.function_group_name,
      packageName,
      transportRequest: resolveTransportRequest(params.transport_request),
      description: params.description
    };
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let functionGroupName: string | null = null;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      functionGroupName = null;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_function_group', 'adt_function_group');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'FunctionGroup - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      functionGroupName = tc.params.function_group_name;
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'FunctionGroup - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'FunctionGroup - full workflow', skipReason);
        return;
      }

      if (!testCase || !functionGroupName) {
        logBuilderTestSkip(testsLogger, 'FunctionGroup - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);

      // Check cleanup settings: cleanup_after_test (global) and skip_cleanup (test-specific or global)
      const envConfig = getEnvironmentConfig();
      const cleanupAfterTest = envConfig.cleanup_after_test !== false; // Default: true if not set
      const globalSkipCleanup = envConfig.skip_cleanup === true;
      const skipCleanup = testCase.params.skip_cleanup !== undefined
        ? testCase.params.skip_cleanup === true
        : globalSkipCleanup;
      const shouldCleanup = cleanupAfterTest && !skipCleanup;

      let functionGroupCreated = false;
      let currentStep = '';

      try {
        currentStep = 'validate';
        logBuilderTestStep(currentStep);
        const validationState = await client.getFunctionGroup().validate({
          functionGroupName: config.functionGroupName,
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
        
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        await client.getFunctionGroup().create({
          functionGroupName: config.functionGroupName,
          packageName: config.packageName!,
          description: config.description || '',
          transportRequest: config.transportRequest
        }, { activateOnCreate: false });
        functionGroupCreated = true;
        // Wait for object to be ready using long polling
        try {
          await client.getFunctionGroup().read({ functionGroupName: config.functionGroupName }, 'active', { withLongPolling: true });
        } catch (readError) {
          testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - check might still work
        }
        
        logBuilderTestStep('activate');
        await client.getFunctionGroup().activate({ functionGroupName: config.functionGroupName });
        // Wait for object to be ready after activation using long polling
        try {
          await client.getFunctionGroup().read({ functionGroupName: config.functionGroupName }, 'active', { withLongPolling: true });
        } catch (readError) {
          testsLogger?.warn?.('read with long polling failed (object may not be ready yet):', readError);
          // Continue anyway - check might still work
        }
        
        logBuilderTestStep('check');
        // Retry check - activation may take time
        const checkResultState = await retryCheckAfterActivate(
          async () => {
            const state = await client.getFunctionGroup().check({ functionGroupName: config.functionGroupName });
            return state?.checkResult;
          },
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.functionGroupName
          }
        );
        // Check only for type E messages - HTTP 200 is normal, errors are in XML response
        // Ignore Kerberos library not loaded (test cloud issue)
        const hasErrors = checkResultState ? hasCheckErrorsFromResponse(checkResultState, ['kerberos library not loaded']) : false;
        if (hasErrors) {
          const errorMessages = checkResultState ? getCheckErrorMessages(parseCheckRunResponse(checkResultState)) : [];
          throw new Error(`Check failed: ${errorMessages.join('; ')}`);
        }
        
        if (shouldCleanup) {
          logBuilderTestStep('delete (cleanup)');
          await client.getFunctionGroup().delete({
            functionGroupName: config.functionGroupName,
            transportRequest: config.transportRequest
          });
        } else {
          testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - function group left for analysis: ${config.functionGroupName}`);
        }

        logBuilderTestSuccess(testsLogger, 'FunctionGroup - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);

        // Cleanup: delete if object was created and cleanup is enabled
        if (shouldCleanup && functionGroupCreated) {
          try {
            logBuilderTestStep('delete (cleanup)');
            await client.getFunctionGroup().delete({
              functionGroupName: config.functionGroupName,
              transportRequest: config.transportRequest
            });
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.functionGroupName}:`, cleanupError);
          }
        } else if (!shouldCleanup && functionGroupCreated) {
          testsLogger.info?.(`⚠️ Cleanup skipped (cleanup_after_test=${cleanupAfterTest}, skip_cleanup=${skipCleanup}) - function group left for analysis: ${config.functionGroupName}`);
        }

        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'FunctionGroup - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'FunctionGroup - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP function group', async () => {
      const testCase = getTestCaseDefinition('create_function_group', 'adt_function_group');
      const standardObject = resolveStandardObject('function_group', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'FunctionGroupBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'FunctionGroupBuilder - read standard object',
          `Standard function group not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardFunctionGroupName = standardObject.name;
      logBuilderTestStart(testsLogger, 'FunctionGroupBuilder - read standard object', {
        name: 'read_standard',
        params: { function_group_name: standardFunctionGroupName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'FunctionGroupBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const resultState = await client.getFunctionGroup().read({ functionGroupName: standardFunctionGroupName });
        expect(resultState).toBeDefined();
        expect(resultState?.readResult).toBeDefined();
        // FunctionGroup read returns function group config - check if functionGroupName is present
        const functionGroupConfig = resultState?.readResult;
        if (functionGroupConfig && typeof functionGroupConfig === 'object' && 'functionGroupName' in functionGroupConfig) {
          expect((functionGroupConfig as any).functionGroupName).toBe(standardFunctionGroupName);
        }

        logBuilderTestSuccess(testsLogger, 'FunctionGroupBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(testsLogger, 'FunctionGroupBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'FunctionGroupBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});
