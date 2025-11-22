/**
 * Unit test for FunctionModuleBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionModule/FunctionModuleBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { FunctionModuleBuilder, FunctionModuleBuilderLogger } from '../../../core/functionModule';
import { FunctionGroupBuilder } from '../../../core/functionGroup';
import { deleteFunctionModule } from '../../../core/functionModule/delete';
import { deleteFunctionGroup } from '../../../core/functionGroup/delete';
import { unlockFunctionModule } from '../../../core/functionModule/unlock';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';
import { getConfig, generateSessionId } from '../../helpers/sessionConfig';
import { getTestLock, createOnLockCallback } from '../../helpers/lockHelper';
import {
  logBuilderTestStart,
  logBuilderTestSkip,
  logBuilderTestSuccess,
  logBuilderTestError,
  logBuilderTestEnd,
  logBuilderTestStep
} from '../../helpers/builderTestLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const {
  getEnabledTestCase,
  getTestCaseDefinition,
  resolvePackageName,
  resolveTransportRequest,
  ensurePackageConfig,
  resolveStandardObject
} = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const connectionLogger: ILogger = {
  debug: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  info: debugEnabled ? (message: string, meta?: any) => console.log(message, meta) : () => {},
  warn: debugEnabled ? (message: string, meta?: any) => console.warn(message, meta) : () => {},
  error: debugEnabled ? (message: string, meta?: any) => console.error(message, meta) : () => {},
  csrfToken: debugEnabled ? (action: string, token?: string) => console.log(`CSRF ${action}:`, token) : () => {},
};

const builderLogger: FunctionModuleBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('FunctionModuleBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
      // Check if this is a cloud system
      isCloudSystem = await isCloudEnvironment(connection);
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
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
  async function ensureFunctionModuleReady(
    functionGroupName: string,
    functionModuleName: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true }; // No connection = nothing to clean
    }

    let lockedReason: string | null = null;

    // Step 1: Check for locks and unlock if needed
    const lock = getTestLock('fm', functionModuleName, functionGroupName);
    if (lock) {
      try {
        const sessionId = lock.sessionId || generateSessionId('cleanup');
        await unlockFunctionModule(connection, functionGroupName, functionModuleName, lock.lockHandle, sessionId);
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Unlocked function module ${functionGroupName}/${functionModuleName} before deletion`);
        }
      } catch (unlockError: any) {
        // Log but continue - lock might be stale
        if (debugEnabled) {
          builderLogger.warn?.(`[CLEANUP] Failed to unlock function module ${functionGroupName}/${functionModuleName}: ${unlockError.message}`);
        }
      }
    }

    // Step 2: Try to delete (ignore all errors, but log if DEBUG_TESTS=true)
    try {
      await deleteFunctionModule(connection, {
        function_group_name: functionGroupName,
        function_module_name: functionModuleName
      });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Successfully deleted function module ${functionGroupName}/${functionModuleName}`);
      }
    } catch (error: any) {
      const status = error.response?.status;
      const statusText = status ? `HTTP ${status}` : 'HTTP ?';
      const errorMsg = error.message || '';
      const errorData = error.response?.data || '';
      console.warn(`[CLEANUP][FunctionModule] Failed to delete ${functionGroupName}/${functionModuleName} (${statusText}): ${errorMsg} ${errorData}`);
      if (status === 423) {
        lockedReason = `Function module ${functionModuleName} is locked by another user (HTTP 423 Locked)`;
      }
    }

    if (lockedReason) {
      return { success: false, reason: lockedReason };
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
      const builder = new FunctionGroupBuilder(connection, {}, {
        functionGroupName: functionGroupName,
        packageName: packageName,
        transportRequest: transportRequest,
        description: `Test function group for ${functionGroupName}`
      });
      await builder.create();
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

    // Try to delete Function Module (ignore errors)
    try {
      await deleteFunctionModule(connection, {
        function_group_name: functionGroupName,
        function_module_name: functionModuleName
      });
    } catch (error) {
      // Ignore all errors (404, locked, etc.)
    }

    // Try to delete Function Group (ignore errors)
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
    let skipReason: string | null = null;

    beforeEach(async () => {
      skipReason = null;
      testCase = null;
      functionGroupName = null;
      functionModuleName = null;

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

      // Cleanup before test: delete Function Module if exists
      if (functionGroupName && functionModuleName) {
        const cleanup = await ensureFunctionModuleReady(functionGroupName, functionModuleName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup Function Module before test';
          testCase = null;
          functionGroupName = null;
          functionModuleName = null;
          return;
        }
      }

      // Ensure Function Group exists before test
      if (functionGroupName) {
        const packageName = resolvePackageName(tc.params.package_name);
        const transportRequest = resolveTransportRequest(tc.params.transport_request);
        const setup = await ensureFunctionGroupExists(functionGroupName, packageName, transportRequest);
        if (!setup.success) {
          skipReason = setup.reason || 'Failed to setup Function Group';
          testCase = null;
          functionGroupName = null;
          functionModuleName = null;
        }
      }
    });

    afterEach(async () => {
      if (functionGroupName && functionModuleName && connection) {
        // Cleanup after test: delete Function Module and Function Group
        const cleanup = await cleanupFunctionModuleAndGroup(functionGroupName, functionModuleName);
        if (!cleanup.success && cleanup.reason) {
          console.warn(`[CLEANUP][FunctionModule] ${cleanup.reason}`);
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'FunctionModuleBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'FunctionModuleBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !functionGroupName || !functionModuleName) {
        logBuilderTestSkip(builderLogger, 'FunctionModuleBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      let builder: FunctionModuleBuilder | null = null;
      try {
        const packageName = resolvePackageName(testCase.params.package_name);
        if (!packageName) {
          logBuilderTestSkip(builderLogger, 'FunctionModuleBuilder - full workflow', 'package_name not configured');
          return;
        }
        builder = new FunctionModuleBuilder(connection, builderLogger, {
          functionGroupName,
          functionModuleName,
          sourceCode: testCase.params.source_code,
          packageName,
          transportRequest: resolveTransportRequest(testCase.params.transport_request),
          description: testCase.params.description,
          onLock: createOnLockCallback('fm', functionModuleName, functionGroupName, __filename)
        });
        
        const sourceCode = testCase.params.source_code;
        
        logBuilderTestStep('validate');
      await builder
        .validate()
          .then(b => {
            logBuilderTestStep('create');
            return b.create();
          })
          .then(async b => {
            // Wait for SAP to finish create operation (includes lock/unlock internally)
            await new Promise(resolve => setTimeout(resolve, 1000));
            logBuilderTestStep('lock');
            return b.lock();
          })
          .then(b => {
            logBuilderTestStep('check with source code (before update)');
            return b.check('inactive', sourceCode);
          })
          .then(b => {
            logBuilderTestStep('update');
            return b.update();
          })
          .then(b => {
            logBuilderTestStep('check');
            return b.check();
          })
          .then(b => {
            logBuilderTestStep('unlock');
            return b.unlock();
        })
          .then(b => {
            logBuilderTestStep('activate');
            return b.activate();
        });

      const state = builder.getState();
      expect(state.createResult).toBeDefined();
      expect(state.activateResult).toBeDefined();
      expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(builderLogger, 'FunctionModuleBuilder - full workflow');
      } catch (error: any) {
        // Extract error message from error object (may be in message or response.data)
        const errorMsg = error.message || '';
        const errorData = error.response?.data || '';
        const errorText = typeof errorData === 'string' ? errorData : JSON.stringify(errorData);
        const fullErrorText = `${errorMsg} ${errorText}`.toLowerCase();

        // "Already exists" errors should fail the test (cleanup must work)
        logBuilderTestError(builderLogger, 'FunctionModuleBuilder - full workflow', error);
        throw error;
      } finally {
        // Guaranteed unlock: always try to unlock if builder was created and has lockHandle
        if (builder) {
          await builder.forceUnlock().catch(() => {});
        }
        logBuilderTestEnd(builderLogger, 'FunctionModuleBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP function module', async () => {
      const testCase = getTestCaseDefinition('create_function_module', 'builder_function_module');
      const standardObject = resolveStandardObject('function_module', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(builderLogger, 'FunctionModuleBuilder - read standard object', {
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
      logBuilderTestStart(builderLogger, 'FunctionModuleBuilder - read standard object', {
        name: 'read_standard',
        params: {
          function_group_name: standardFunctionGroupName,
          function_module_name: standardFunctionModuleName
        }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'FunctionModuleBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName: standardFunctionGroupName,
        functionModuleName: standardFunctionModuleName,
        description: '', // Not used for read operations
        sourceCode: '' // Not needed for read
      });

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(builderLogger, 'FunctionModuleBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'FunctionModuleBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'FunctionModuleBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});

