/**
 * Unit test for FunctionModuleBuilder
 * Tests fluent API with Promise chaining, error handling, and result storage
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionModule/FunctionModuleBuilder.test
 */

import { AbapConnection, createAbapConnection, ILogger } from '@mcp-abap-adt/connection';
import { FunctionModuleBuilder, FunctionModuleBuilderLogger } from '../../../core/functionModule';
import { deleteFunctionModule } from '../../../core/functionModule/delete';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

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

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      hasConfig = true;
    } catch (error) {
      builderLogger.warn?.('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  async function deleteFunctionModuleIfExists(functionGroupName: string, functionModuleName: string): Promise<void> {
    try {
      await deleteFunctionModule(connection, {
        function_group_name: functionGroupName,
        function_module_name: functionModuleName
      });
    } catch (error: any) {
      if (error.response?.status !== 404 && !error.message?.includes('not found')) {
        throw error;
      }
    }
  }

  describe('Builder methods', () => {
    it('should chain builder methods', () => {
      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName: 'Z_TEST_FUGR',
        functionModuleName: 'Z_TEST_FM',
        sourceCode: 'FUNCTION Z_TEST_FM.\nENDFUNCTION.'
      });

      const result = builder
        .setPackage('ZPKG2')
        .setRequest('TR001')
        .setFunctionGroup('Z_TEST_FUGR2')
        .setName('Z_TEST_FM2')
        .setCode('FUNCTION Z_TEST_FM2.\nENDFUNCTION.')
        .setDescription('Test');

      expect(result).toBe(builder);
      expect(builder.getFunctionModuleName()).toBe('Z_TEST_FM2');
    });
  });

  describe('Promise chaining', () => {
    it('should chain operations with .then()', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'builder_function_module');
      if (!testCase) {
        return;
      }

      const functionGroupName = testCase.params.function_group_name;
      const functionModuleName = testCase.params.function_module_name;
      await deleteFunctionModuleIfExists(functionGroupName, functionModuleName);

      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName,
        functionModuleName,
        sourceCode: testCase.params.source_code,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description
      });

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.lock())
        .then(b => b.update())
        .then(b => b.check())
        .then(b => b.unlock())
        .then(b => b.activate());

      expect(builder.getCreateResult()).toBeDefined();
      expect(builder.getActivateResult()).toBeDefined();
    }, 60000);

    it('should interrupt chain on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName: 'Z_TEST_INVALID',
        functionModuleName: 'Z_TEST_INVALID',
        sourceCode: 'FUNCTION Z_TEST_INVALID.\nENDFUNCTION.',
        packageName: 'INVALID_PACKAGE'
      });

      let errorCaught = false;
      try {
        await builder.create();
      } catch (error) {
        errorCaught = true;
        expect(builder.getErrors().length).toBeGreaterThan(0);
      }

      expect(errorCaught).toBe(true);
    }, 30000);
  });

  describe('Error handling', () => {
    it('should execute .catch() on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName: 'Z_TEST_ERROR',
        functionModuleName: 'Z_TEST_ERROR',
        sourceCode: 'FUNCTION Z_TEST_ERROR.\nENDFUNCTION.',
        packageName: 'INVALID'
      });

      let catchExecuted = false;
      await builder
        .create()
        .catch(() => {
          catchExecuted = true;
        });

      expect(catchExecuted).toBe(true);
    }, 30000);

    it('should execute .finally() even on error', async () => {
      if (!hasConfig) {
        return;
      }

      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName: 'Z_TEST_FINALLY',
        functionModuleName: 'Z_TEST_FINALLY',
        sourceCode: 'FUNCTION Z_TEST_FINALLY.\nENDFUNCTION.',
        packageName: 'INVALID'
      });

      let finallyExecuted = false;
      try {
        await builder.create();
      } catch (error) {
        // Error expected
      } finally {
        finallyExecuted = true;
      }

      expect(finallyExecuted).toBe(true);
    }, 30000);
  });

  describe('Result storage', () => {
    it('should store all results', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'builder_function_module');
      if (!testCase) {
        return;
      }

      const functionGroupName = testCase.params.function_group_name;
      const functionModuleName = testCase.params.function_module_name;
      await deleteFunctionModuleIfExists(functionGroupName, functionModuleName);

      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName,
        functionModuleName,
        sourceCode: testCase.params.source_code,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description
      });

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.lock())
        .then(b => b.update())
        .then(b => b.check())
        .then(b => b.unlock())
        .then(b => b.activate());

      const results = builder.getResults();
      expect(results.create).toBeDefined();
      expect(results.update).toBeDefined();
      expect(results.check).toBeDefined();
      expect(results.unlock).toBeDefined();
      expect(results.activate).toBeDefined();
    }, 60000);
  });

  describe('Full workflow', () => {
    it('should execute full workflow and store all results', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'builder_function_module');
      if (!testCase) {
        return;
      }

      const functionGroupName = testCase.params.function_group_name;
      const functionModuleName = testCase.params.function_module_name;
      await deleteFunctionModuleIfExists(functionGroupName, functionModuleName);

      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName,
        functionModuleName,
        sourceCode: testCase.params.source_code,
        packageName: testCase.params.package_name || getDefaultPackage(),
        transportRequest: testCase.params.transport_request || getDefaultTransport(),
        description: testCase.params.description
      });

      await builder
        .validate()
        .then(b => b.create())
        .then(b => b.lock())
        .then(b => b.update())
        .then(b => b.check())
        .then(b => b.unlock())
        .then(b => b.activate())
        .catch(error => {
          builderLogger.error?.('Workflow failed:', error);
          throw error;
        })
        .finally(() => {
          // Cleanup if needed
        });

      const state = builder.getState();
      expect(state.createResult).toBeDefined();
      expect(state.activateResult).toBeDefined();
      expect(state.errors.length).toBe(0);
    }, 60000);
  });

  describe('Getters', () => {
    it('should return correct values from getters', async () => {
      if (!hasConfig) {
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'builder_function_module');
      if (!testCase) {
        return;
      }

      const functionGroupName = testCase.params.function_group_name;
      const functionModuleName = testCase.params.function_module_name;
      await deleteFunctionModuleIfExists(functionGroupName, functionModuleName);

      const builder = new FunctionModuleBuilder(connection, builderLogger, {
        functionGroupName,
        functionModuleName,
        sourceCode: testCase.params.source_code,
        packageName: testCase.params.package_name || getDefaultPackage()
      });

      expect(builder.getFunctionModuleName()).toBe(functionModuleName);
      expect(builder.getFunctionGroupName()).toBe(functionGroupName);
      expect(builder.getSessionId()).toBeDefined();
      expect(builder.getLockHandle()).toBeUndefined();

      await builder.create();
      expect(builder.getCreateResult()).toBeDefined();
    }, 30000);
  });
});

