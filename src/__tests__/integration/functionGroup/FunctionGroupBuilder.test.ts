/**
 * Integration test for FunctionGroupBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - FunctionGroupBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=functionGroup/FunctionGroupBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { CrudClient } from '../../../clients/CrudClient';
import { IAdtLogger } from '../../../utils/logger';
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

// Library code uses DEBUG_ADT_LIBS
const builderLogger: IAdtLogger = createBuilderLogger();

// Test execution logs use DEBUG_ADT_TESTS
const testsLogger: IAdtLogger = createTestsLogger();

describe('FunctionGroupBuilder (using CrudClient)', () => {
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
    return getTestCaseDefinition('create_function_group', 'builder_function_group');
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

      const tc = getEnabledTestCase('create_function_group', 'builder_function_group');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'FunctionGroupBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      functionGroupName = tc.params.function_group_name;
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'FunctionGroupBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'FunctionGroupBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !functionGroupName) {
        logBuilderTestSkip(testsLogger, 'FunctionGroupBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const config = buildBuilderConfig(testCase);

      let functionGroupCreated = false;
      let functionGroupLocked = false;
      let currentStep = '';

      try {
        currentStep = 'validate';
        logBuilderTestStep(currentStep);
        const validationResponse = await client.validateFunctionGroup({
          functionGroupName: config.functionGroupName,
          packageName: config.packageName!,
          description: config.description || ''
        });
        if (validationResponse?.status !== 200) {
          const errorData = typeof validationResponse?.data === 'string' 
            ? validationResponse.data 
            : JSON.stringify(validationResponse?.data);
          console.error(`Validation failed (HTTP ${validationResponse?.status}): ${errorData}`);
        }
        expect(validationResponse?.status).toBe(200);
        
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        await client.createFunctionGroup({
          functionGroupName: config.functionGroupName,
          packageName: config.packageName!,
          description: config.description || '',
          transportRequest: config.transportRequest
        });
        functionGroupCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
        currentStep = 'lock';
        logBuilderTestStep(currentStep);
        await client.lockFunctionGroup({ functionGroupName: config.functionGroupName });
        functionGroupLocked = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
        
        currentStep = 'unlock';
        logBuilderTestStep(currentStep);
        await client.unlockFunctionGroup({ functionGroupName: config.functionGroupName });
        functionGroupLocked = false;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
        
        logBuilderTestStep('activate');
        await client.activateFunctionGroup({ functionGroupName: config.functionGroupName });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
        logBuilderTestStep('check');
        // Retry check - activation may take time
        const checkResult = await retryCheckAfterActivate(
          () => client.checkFunctionGroup({ functionGroupName: config.functionGroupName }),
          {
            maxAttempts: 5,
            delay: 1000,
            logger: testsLogger,
            objectName: config.functionGroupName
          }
        );
        expect(checkResult?.status).toBeDefined();
        
        logBuilderTestStep('delete (cleanup)');
        await client.deleteFunctionGroup({
          functionGroupName: config.functionGroupName,
          transportRequest: config.transportRequest
        });

        expect(client.getCreateResult()).toBeDefined();
        expect(client.getActivateResult()).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'FunctionGroupBuilder - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);

        // Cleanup: unlock and delete if object was created/locked
        if (functionGroupLocked || functionGroupCreated) {
          try {
            if (functionGroupLocked) {
              logBuilderTestStep('unlock (cleanup)');
              await client.unlockFunctionGroup({ functionGroupName: config.functionGroupName });
            }
            if (functionGroupCreated) {
              logBuilderTestStep('delete (cleanup)');
              await client.deleteFunctionGroup({
                functionGroupName: config.functionGroupName,
                transportRequest: config.transportRequest
              });
            }
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${config.functionGroupName}:`, cleanupError);
          }
        }

        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'FunctionGroupBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        logBuilderTestEnd(testsLogger, 'FunctionGroupBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP function group', async () => {
      const testCase = getTestCaseDefinition('create_function_group', 'builder_function_group');
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
        const result = await client.readFunctionGroup(standardFunctionGroupName);
        expect(result).toBeDefined();
        expect(result?.functionGroupName).toBe(standardFunctionGroupName);

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
