/**
 * Unit test for FunctionGroupBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- integration/functionGroup/FunctionGroupBuilder
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { FunctionGroupBuilder, FunctionGroupBuilderLogger } from '../../../core/functionGroup';
import { deleteFunctionGroup } from '../../../core/functionGroup/delete';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { isCloudEnvironment } from '../../../core/shared/systemInfo';
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

const builderLogger: FunctionGroupBuilderLogger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
};

describe('FunctionGroupBuilder', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    // Count total tests for progress tracking
    const testCount = 2; // Full workflow + Read standard object
    setTotalTests(testCount);

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
    resetTestCounter();
    if (connection) {
      connection.reset();
    }
  });

  async function ensureFunctionGroupReady(functionGroupName: string): Promise<{ success: boolean; reason?: string }> {
    if (!connection) {
      return { success: true }; // No connection = nothing to clean
    }

    // Try to delete (ignore all errors)
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

      // Cleanup before test
      if (functionGroupName) {
        const cleanup = await ensureFunctionGroupReady(functionGroupName);
        if (!cleanup.success) {
          skipReason = cleanup.reason || 'Failed to cleanup function group before test';
        testCase = null;
        functionGroupName = null;
      }
      }
    });

    afterEach(async () => {
      if (functionGroupName && connection) {
        // Cleanup after test
        const cleanup = await ensureFunctionGroupReady(functionGroupName);
        if (!cleanup.success && cleanup.reason) {
          if (debugEnabled) {
            builderLogger.warn?.(`[CLEANUP] Cleanup failed: ${cleanup.reason}`);
          }
        }
      }
    });

    it('should execute full workflow and store all results', async () => {
      const definition = getBuilderTestDefinition();
      logBuilderTestStart(builderLogger, 'FunctionGroupBuilder - full workflow', definition);

      if (skipReason) {
        logBuilderTestSkip(builderLogger, 'FunctionGroupBuilder - full workflow', skipReason);
        return;
      }

      if (!testCase || !functionGroupName) {
        logBuilderTestSkip(builderLogger, 'FunctionGroupBuilder - full workflow', skipReason || 'Test case not available');
        return;
      }

      const builder = new FunctionGroupBuilder(connection, builderLogger, buildBuilderConfig(testCase));

      try {
        logBuilderTestStep('validate');
      await builder
        .validate()
          .then(b => {
            logBuilderTestStep('create');
            return b.create();
          })
          .then(b => {
            logBuilderTestStep('lock');
            return b.lock();
          })
          .then(b => {
            logBuilderTestStep('unlock');
            return b.unlock();
          })
          .then(b => {
            logBuilderTestStep('activate');
            return b.activate();
        })
          .then(b => {
            logBuilderTestStep('check');
            return b.check();
        });

      const state = builder.getState();
      expect(state.createResult).toBeDefined();
      expect(state.activateResult).toBeDefined();
      expect(state.errors.length).toBe(0);

        logBuilderTestSuccess(builderLogger, 'FunctionGroupBuilder - full workflow');
      } catch (error) {
        logBuilderTestError(builderLogger, 'FunctionGroupBuilder - full workflow', error);
        throw error;
      } finally {
        await builder.forceUnlock().catch(() => {});
        logBuilderTestEnd(builderLogger, 'FunctionGroupBuilder - full workflow');
      }
    }, getTimeout('test'));
  });

  describe('Read standard object', () => {
    it('should read standard SAP function group', async () => {
      const testCase = getTestCaseDefinition('create_function_group', 'builder_function_group');
      const standardObject = resolveStandardObject('function_group', isCloudSystem, testCase);

      if (!standardObject) {
        logBuilderTestStart(builderLogger, 'FunctionGroupBuilder - read standard object', {
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
      logBuilderTestStart(builderLogger, 'FunctionGroupBuilder - read standard object', {
        name: 'read_standard',
        params: { function_group_name: standardFunctionGroupName }
      });

      if (!hasConfig) {
        logBuilderTestSkip(builderLogger, 'FunctionGroupBuilder - read standard object', 'No SAP configuration');
        return;
      }

      const builder = new FunctionGroupBuilder(connection, builderLogger, {
        functionGroupName: standardFunctionGroupName,
        packageName: 'SAP' // Standard package
      });

      try {
        logBuilderTestStep('read');
        await builder.read();

        const result = builder.getReadResult();
        expect(result).toBeDefined();
        expect(result?.status).toBe(200);
        expect(result?.data).toBeDefined();

        logBuilderTestSuccess(builderLogger, 'FunctionGroupBuilder - read standard object');
      } catch (error) {
        logBuilderTestError(builderLogger, 'FunctionGroupBuilder - read standard object', error);
        throw error;
      } finally {
        logBuilderTestEnd(builderLogger, 'FunctionGroupBuilder - read standard object');
      }
    }, getTimeout('test'));
  });
});
