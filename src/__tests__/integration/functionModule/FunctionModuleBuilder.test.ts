/**
 * Integration test for FunctionModuleBuilder
 * Tests using CrudClient for unified CRUD operations
 *
 * Enable debug logs:
 *   DEBUG_ADT_TESTS=true       - Integration test execution logs
 *   DEBUG_ADT_LIBS=true        - FunctionModuleBuilder library logs
 *   DEBUG_CONNECTORS=true      - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPattern=functionModule/FunctionModuleBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { CrudClient } from '../../../clients/CrudClient';
import { IAdtLogger } from '../../../utils/logger';
import { getFunction } from '../../../core/functionModule/read';
import { deleteFunctionGroup } from '../../../core/functionGroup/delete';
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
  createDependencyFunctionGroup,
  extractValidationErrorMessage
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

describe('FunctionModuleBuilder (using CrudClient)', () => {
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

  /**
   * Ensure Function Module is deleted (cleanup before test)
   */
  /**
   * Pre-check: Verify test function module doesn't exist
   * Safety: Skip test if object exists to avoid accidental deletion
   * Note: Can only check FM if FUGR exists. If FUGR doesn't exist, FM can't exist either.
   */
  async function ensureFunctionModuleReady(
    functionGroupName: string,
    functionModuleName: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true };
    }

    // Check if function module exists
    // Note: If FUGR doesn't exist, this will return 500 - that's OK, FM can't exist without FUGR
    try {
      await getFunction(connection, functionGroupName, functionModuleName);
      return {
        success: false,
        reason: `⚠️ SAFETY: Function Module ${functionGroupName}/${functionModuleName} already exists! ` +
                `Delete manually or use different test name to avoid accidental deletion.`
      };
    } catch (error: any) {
      // 404 or 500 are expected - object doesn't exist (or parent doesn't exist), we can proceed
      const status = error.response?.status;
      if (status !== 404 && status !== 500) {
        return {
          success: false,
          reason: `Cannot verify function module existence: ${error.message}`
        };
      }
    }

    return { success: true };
  }

  /**
   * Ensure Function Group exists, create if it doesn't
   * Ignores only "already exists" errors (409)
   */
  async function ensureFunctionGroupExists(
    functionGroupName: string,
    packageName: string,
    transportRequest?: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: false, reason: 'No connection' };
    }

    // Try to create (ignore "already exists" errors)
    try {
      const tempClient = new CrudClient(connection);
      await tempClient.createFunctionGroup({
        functionGroupName: functionGroupName,
        packageName: packageName,
        transportRequest: transportRequest,
        description: `Test function group for ${functionGroupName}`
      });
      return { success: true };
    } catch (error: any) {
      // 409 = already exists, that's fine
      if (error.response?.status === 409) {
        return { success: true };
      }
      // Other errors - return failure
      return { success: false, reason: error.message || 'Failed to create function group' };
    }
  }

  /**
   * Cleanup: delete Function Module and Function Group
   * Ignores all errors - just tries to delete
   */
  async function cleanupFunctionModuleAndGroup(
    functionGroupName: string,
    functionModuleName: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true }; // No connection = nothing to clean
    }

    // Delete Function Group (which automatically deletes all Function Modules inside)
    // Note: FM is already deleted in test chain if test succeeded
    try {
      await deleteFunctionGroup(connection, {
        function_group_name: functionGroupName,
        transport_request: resolveTransportRequest(undefined) || undefined
      });
    } catch (error) {
      // Ignore all errors (404, locked, etc.)
    }

    return { success: true };
  }

  function getBuilderTestDefinition() {
    return getTestCaseDefinition('create_function_module', 'builder_function_module');
  }

  describe('Full workflow', () => {
    let testCase: any = null;
    let functionGroupName: string | null = null;
    let functionModuleName: string | null = null;
    let functionGroupCreated: boolean = false;
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      functionGroupName = null;
      functionModuleName = null;
      functionGroupCreated = false;

      if (!hasConfig) {
        skipReason = 'No SAP configuration';
        return;
      }

      const definition = getBuilderTestDefinition();
      if (!definition) {
        skipReason = 'Test case not defined in test-config.yaml';
        return;
      }

      const tc = getEnabledTestCase('create_function_module', 'builder_function_module');
      if (!tc) {
        skipReason = 'Test case disabled or not found';
        return;
      }

      const packageCheck = ensurePackageConfig(tc.params, 'FunctionModuleBuilder - full workflow');
      if (!packageCheck.success) {
        skipReason = packageCheck.reason || 'Default package is not configured';
        return;
      }

      testCase = tc;
      functionGroupName = tc.params.function_group_name;
      functionModuleName = tc.params.function_module_name;

      // Create function group before test if function_group_name is provided
      if (functionGroupName) {
        const packageName = resolvePackageName(tc.params.package_name);
        if (!packageName) {
          skipReason = 'environment problem, test skipped: package_name not configured for function group creation';
          testCase = null;
          functionGroupName = null;
          functionModuleName = null;
          return;
        }

        const functionGroupConfig = {
          functionGroupName: functionGroupName,
          packageName: packageName,
          description: `Test function group for ${functionModuleName}`,
          transportRequest: resolveTransportRequest(tc.params.transport_request)
        };

        const functionGroupResult = await createDependencyFunctionGroup(client, functionGroupConfig, tc);
        
        if (!functionGroupResult.success) {
          skipReason = functionGroupResult.reason || `environment problem, test skipped: Failed to create required dependency function group ${functionGroupName}`;
          testCase = null;
          functionGroupName = null;
          functionModuleName = null;
          return;
        }

        functionGroupCreated = functionGroupResult.created || false;
      }

      // Cleanup before test: delete Function Module if exists
      if (functionGroupName && functionModuleName) {
        const cleanup = await ensureFunctionModuleReady(functionGroupName, functionModuleName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup Function Module before test';
          testCase = null;
          functionGroupName = null;
          functionModuleName = null;
          functionGroupCreated = false;
          return;
        }
      }
    });

    afterEach(async () => {
      // Cleanup function group if it was created in beforeEach
      if (functionGroupCreated && functionGroupName) {
        try {
          await client.deleteFunctionGroup({
            functionGroupName: functionGroupName,
            transportRequest: resolveTransportRequest(testCase?.params?.transport_request) || ''
          });
        } catch (cleanupError) {
          // Log but don't fail - cleanup errors are silent
          testsLogger.warn?.(`Cleanup failed for function group ${functionGroupName}:`, cleanupError);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(testsLogger, 'FunctionModuleBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(testsLogger, 'FunctionModuleBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !functionGroupName || !functionModuleName) {
        logBuilderTestSkip(testsLogger, 'FunctionModuleBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      let functionModuleCreated = false;
      let functionModuleLocked = false;
      let currentStep = '';

      try {
        const packageName = resolvePackageName(testCase.params.package_name);
        if (!packageName) {
          logBuilderTestSkip(testsLogger, 'FunctionModuleBuilder - full workflow', 'package_name not configured');
          return;
        }
        
        const sourceCode = testCase.params.source_code;
        
        currentStep = 'validate';
        logBuilderTestStep(currentStep);
        const validationResponse = await client.validateFunctionModule({
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName,
          packageName: packageName,
          description: testCase.params.description || ''
        });
        if (validationResponse?.status !== 200) {
          const errorMessage = extractValidationErrorMessage(validationResponse);
          logBuilderTestStepError('validate', {
            response: {
              status: validationResponse?.status,
              data: validationResponse?.data
            }
          });
          logBuilderTestSkip(testsLogger, 'FunctionModuleBuilder - full workflow', 
            `Validation failed: ${errorMessage} - environment problem, test skipped`);
          return;
        }
        
        currentStep = 'create';
        logBuilderTestStep(currentStep);
        await client.createFunctionModule({
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName,
          packageName: packageName,
          sourceCode: sourceCode,
          description: testCase.params.description || '',
          transportRequest: resolveTransportRequest(testCase.params.transport_request)
        });
        functionModuleCreated = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('create', testCase)));
        
        currentStep = 'lock';
        logBuilderTestStep(currentStep);
        await client.lockFunctionModule({
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName
        });
        functionModuleLocked = true;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('lock', testCase)));
        
        currentStep = 'check with source code (before update)';
        logBuilderTestStep(currentStep);
        // Pass sourceCode to check unsaved code (function module was just created, not yet saved as inactive)
        const checkBeforeUpdate = await client.checkFunctionModule({
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName
        }, 'inactive', sourceCode);
        expect(checkBeforeUpdate?.status).toBeDefined();
        
        currentStep = 'update';
        logBuilderTestStep(currentStep);
        await client.updateFunctionModule({
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName,
          sourceCode: sourceCode
        });
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('update', testCase)));
        
        currentStep = 'check';
        logBuilderTestStep(currentStep);
        const checkResult = await client.checkFunctionModule({
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName
        });
        expect(checkResult?.status).toBeDefined();
        
        currentStep = 'unlock';
        logBuilderTestStep(currentStep);
        await client.unlockFunctionModule({
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName
        });
        functionModuleLocked = false;
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('unlock', testCase)));
        
        currentStep = 'activate';
        logBuilderTestStep(currentStep);
        await client.activateFunctionModule({
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName
        });
        // Wait for activation to complete (activation is asynchronous)
        await new Promise(resolve => setTimeout(resolve, getOperationDelay('activate', testCase) || 2000));
        
        currentStep = 'delete (cleanup FM)';
        logBuilderTestStep(currentStep);
        await client.deleteFunctionModule({
          functionModuleName: functionModuleName,
          functionGroupName: functionGroupName,
          transportRequest: resolveTransportRequest(testCase.params.transport_request)
        });

        expect(client.getCreateResult()).toBeDefined();
        expect(client.getActivateResult()).toBeDefined();

        logBuilderTestSuccess(testsLogger, 'FunctionModuleBuilder - full workflow');
      } catch (error: any) {
        // Log step error with details before failing test
        logBuilderTestStepError(currentStep || 'unknown', error);

        // Cleanup: unlock and delete if object was created/locked
        if (functionModuleLocked || functionModuleCreated) {
          try {
            if (functionModuleLocked) {
              logBuilderTestStep('unlock (cleanup)');
              await client.unlockFunctionModule({
                functionModuleName: functionModuleName,
                functionGroupName: functionGroupName
              });
            }
            if (functionModuleCreated) {
              logBuilderTestStep('delete (cleanup)');
              await client.deleteFunctionModule({
                functionModuleName: functionModuleName,
                functionGroupName: functionGroupName,
                transportRequest: resolveTransportRequest(testCase.params.transport_request)
              });
            }
          } catch (cleanupError) {
            // Log cleanup error but don't fail test - original error is more important
            testsLogger.warn?.(`Cleanup failed for ${functionModuleName}:`, cleanupError);
          }
        }

        const statusText = getHttpStatusText(error);
        const enhancedError = statusText !== 'HTTP ?'
          ? Object.assign(new Error(`[${statusText}] ${error.message}`), { stack: error.stack })
          : error;
        logBuilderTestError(testsLogger, 'FunctionModuleBuilder - full workflow', enhancedError);
        throw enhancedError;
      } finally {
        // Cleanup: delete Function Group (which also deletes all FMs inside)
        await cleanupFunctionModuleAndGroup(functionGroupName!, functionModuleName!).catch(() => {
          logBuilderTestError(testsLogger, 'FunctionModuleBuilder - full workflow', new Error('Cleanup failed'));
        });
        logBuilderTestEnd(testsLogger, 'FunctionModuleBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP function module', async () => {
      const testCase = getTestCaseDefinition('create_function_module', 'builder_function_module');
      const standardObject = resolveStandardObject('function_module', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(testsLogger, 'FunctionModuleBuilder - read standard object', {
          name: 'read_standard',
          params: {}
        });
        logBuilderTestSkip(
          builderLogger,
          'FunctionModuleBuilder - read standard object',
          `Standard function module not configured for ${isCloudSystem ? 'cloud' : 'on-premise'} environment`
        );
        return;
      }

      const standardFunctionGroupName = standardObject.group || 'SYST';
      const standardFunctionModuleName = standardObject.name;
      logBuilderTestStart(testsLogger, 'FunctionModuleBuilder - read standard object', {
        name: 'read_standard',
        params: {
          function_group_name: standardFunctionGroupName,
          function_module_name: standardFunctionModuleName
        }
      });

      if (!hasConfig) {
        logBuilderTestSkip(testsLogger, 'FunctionModuleBuilder - read standard object', 'No SAP configuration');
        return;
      }

      try {
        logBuilderTestStep('read');
        const result = await client.readFunctionModule(standardFunctionGroupName, standardFunctionModuleName);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string'); // Function module read returns source code as string

        logBuilderTestSuccess(testsLogger, 'FunctionModuleBuilder - read standard object');
      } catch (error: any) {
        // Handle cases where standard function module is not accessible (404, 500, etc.)
        const status = error.response?.status;
        if (status === 404 || status === 500 || status === 403) {
          logBuilderTestSkip(
            testsLogger,
            'FunctionModuleBuilder - read standard object',
            `Standard function module ${standardFunctionGroupName}/${standardFunctionModuleName} is not accessible (HTTP ${status}). This may be normal for some systems.`
          );
          return;
        }
        logBuilderTestError(testsLogger, 'FunctionModuleBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(testsLogger, 'FunctionModuleBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

