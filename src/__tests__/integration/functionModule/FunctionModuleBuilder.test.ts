/**
 * Unit test for FunctionModuleBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionModule/FunctionModuleBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { FunctionModuleBuilder, FunctionModuleBuilderLogger } from '../../../core/functionModule';
import { deleteFunctionModule } from '../../../core/functionModule/delete';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { deleteFunctionGroup } from '../../../core/functionGroup/delete';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getConfig } from '../../helpers/sessionConfig';
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
  getDefaultPackage,
  getDefaultTransport
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

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
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
   * Ensure Function Group exists, create if it doesn't
   */
  async function ensureFunctionGroupExists(
    functionGroupName: string,
    packageName: string,
    transportRequest?: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: false, reason: 'No connection' };
    }

    // Check if Function Group exists
    try {
      await getFunctionGroup(connection, functionGroupName);
      // Function Group exists
      if (debugEnabled) {
        builderLogger.debug?.(`[SETUP] Function group ${functionGroupName} already exists`);
      }
      return { success: true };
    } catch (error: any) {
      // 404 = Function Group doesn't exist, create it
      if (error.response?.status === 404) {
        try {
          if (debugEnabled) {
            builderLogger.debug?.(`[SETUP] Creating function group ${functionGroupName}`);
          }
          await createFunctionGroup(connection, {
            function_group_name: functionGroupName,
            package_name: packageName,
            transport_request: transportRequest,
            description: `Test function group for ${functionGroupName}`,
            activate: false
          });
          if (debugEnabled) {
            builderLogger.debug?.(`[SETUP] Function group ${functionGroupName} created`);
          }
          return { success: true };
        } catch (createError: any) {
          const errorMsg = `Failed to create function group ${functionGroupName}: ${createError.message}`;
          if (debugEnabled) {
            builderLogger.warn?.(`[SETUP] ${errorMsg}`);
          }
          return { success: false, reason: errorMsg };
        }
      }
      // Other error
      const errorMsg = `Cannot check/create function group ${functionGroupName}: ${error.message}`;
      if (debugEnabled) {
        builderLogger.warn?.(`[SETUP] ${errorMsg}`);
      }
      return { success: false, reason: errorMsg };
    }
  }

  /**
   * Cleanup: delete Function Module and Function Group
   */
  async function cleanupFunctionModuleAndGroup(
    functionGroupName: string,
    functionModuleName: string
  ): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: false, reason: 'No connection' };
    }

    // Delete Function Module first
    try {
      await deleteFunctionModule(connection, {
        function_group_name: functionGroupName,
        function_module_name: functionModuleName
      });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Function module ${functionModuleName} deleted`);
      }
    } catch (error: any) {
      const rawMessage =
        error?.response?.data ||
        error?.message ||
        (typeof error === 'string' ? error : JSON.stringify(error));

      // 404 = doesn't exist, that's fine
      if (
        error.response?.status === 404 ||
        rawMessage?.toLowerCase?.().includes('not found') ||
        rawMessage?.toLowerCase?.().includes('does not exist')
      ) {
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Function module ${functionModuleName} already absent`);
        }
      } else {
        // Other errors - log only in debug mode
        if (debugEnabled) {
          builderLogger.warn?.(`[CLEANUP] Failed to delete function module ${functionModuleName}:`, rawMessage);
      }
      }
    }

    // Wait a bit for async deletion
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Delete Function Group
    try {
      await deleteFunctionGroup(connection, {
        function_group_name: functionGroupName,
        transport_request: getDefaultTransport() || undefined
      });
      if (debugEnabled) {
        builderLogger.debug?.(`[CLEANUP] Function group ${functionGroupName} deleted`);
      }
    } catch (error: any) {
      const rawMessage =
        error?.response?.data ||
        error?.message ||
        (typeof error === 'string' ? error : JSON.stringify(error));

      // 404 = doesn't exist, that's fine
      if (
        error.response?.status === 404 ||
        rawMessage?.toLowerCase?.().includes('not found') ||
        rawMessage?.toLowerCase?.().includes('does not exist')
      ) {
        if (debugEnabled) {
          builderLogger.debug?.(`[CLEANUP] Function group ${functionGroupName} already absent`);
        }
      } else {
        // Other errors - log only in debug mode
        if (debugEnabled) {
          builderLogger.warn?.(`[CLEANUP] Failed to delete function group ${functionGroupName}:`, rawMessage);
        }
      }
    }

    // Verify cleanup (wait a bit more)
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      await getFunctionGroup(connection, functionGroupName);
      // Function Group still exists
      const errorMsg = `Function group ${functionGroupName} still exists after cleanup attempt (may be locked or in use)`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}`);
      }
      return { success: false, reason: errorMsg };
    } catch (error: any) {
      // 404 = Function Group doesn't exist, cleanup successful
      if (error.response?.status === 404) {
        return { success: true };
      }
      // Other error
      const errorMsg = `Cannot verify cleanup status for ${functionGroupName} (may be locked)`;
      if (debugEnabled) {
        builderLogger.warn?.(`[CLEANUP] ${errorMsg}:`, error.message);
      }
      return { success: false, reason: errorMsg };
      }
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

      testCase = tc;
      functionGroupName = tc.params.function_group_name;
      functionModuleName = tc.params.function_module_name;

      // Ensure Function Group exists before test
      if (functionGroupName) {
        const packageName = tc.params.package_name || getDefaultPackage();
        const transportRequest = tc.params.transport_request || getDefaultTransport();
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
          if (debugEnabled) {
            builderLogger.warn?.(`[CLEANUP] Cleanup failed: ${cleanup.reason}`);
          }
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
        builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName,
        functionModuleName,
        sourceCode: testCase.params.source_code,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description
      });
        logBuilderTestStep('validate');
      await builder
        .validate()
          .then(b => {
            logBuilderTestStep('create');
            return b.create();
          })
          .then(b => {
            logBuilderTestStep('check');
            return b.check();
          })
          .then(b => {
            logBuilderTestStep('lock');
            return b.lock();
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
      } catch (error) {
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
      // Standard SAP function module (exists in most ABAP systems)
      const standardFunctionGroupName = 'SYST'; // Standard SAP function group
      const standardFunctionModuleName = 'SYSTEM_INFO'; // Standard SAP function module (in SYST group)
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

      const builder = new FunctionModuleBuilder(
        connection,
        builderLogger,
        {
          functionGroupName: standardFunctionGroupName,
          functionModuleName: standardFunctionModuleName,
          sourceCode: '' // Not needed for read
        }
      );

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

