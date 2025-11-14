/**
 * Integration tests for Function Module operations
 * Tests: create, read, update, delete, check, activate, lock/unlock
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- testFunctionModule.integration.test.ts
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createFunctionGroup } from '../../core/functionGroup/create';
import { getFunctionGroup } from '../../core/functionGroup/read';
import { createFunctionModule } from '../../core/functionModule/create';
import { getFunction } from '../../core/functionModule/read';
import { updateFunctionModuleSource } from '../../core/functionModule/update';
import { activateFunctionModule } from '../../core/functionModule/activation';
import { checkFunctionModule, validateFunctionModuleSource } from '../../core/functionModule/check';
import { lockFunctionModuleForUpdate } from '../../core/functionModule/lock';
import { unlockFunctionModule } from '../../core/functionModule/unlock';
import { deleteObject } from '../../core/delete';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load test helper
const { getEnabledTestCase } = require('../../../tests/test-helper');

// Load environment variables
const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

// Enable debug logging with DEBUG_TESTS=true
const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: console.warn,
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE || 'basic';
  const authType = rawAuthType.split('#')[0].trim();

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }

  const config: SapConfig = {
    url,
    authType: authType === 'xsuaa' ? 'jwt' : (authType as 'basic' | 'jwt'),
  };

  if (client) {
    config.client = client;
  }

  if (authType === 'jwt' || authType === 'xsuaa') {
    const jwtToken = process.env.SAP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error('Missing SAP_JWT_TOKEN for JWT authentication');
    }
    config.jwtToken = jwtToken;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error('Missing SAP_USERNAME or SAP_PASSWORD for basic authentication');
    }
    config.username = username;
    config.password = password;
  }

  return config;
}

describe('Function Module Operations (Integration)', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let functionGroupName: string;
  let functionModuleName: string;
  let packageName: string;
  let sourceCode: string;
  let updatedSourceCode: string;
  let activeLockHandle: string | null = null;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      console.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    // Clean up any active locks
    if (activeLockHandle && functionGroupName && functionModuleName) {
      try {
        logger.debug(`🔓 Cleaning up lock: ${activeLockHandle}`);
        await unlockFunctionModule(connection, functionGroupName, functionModuleName, activeLockHandle, '');
        activeLockHandle = null;
      } catch (error) {
        logger.warn(`⚠️ Failed to unlock in cleanup: ${error}`);
      }
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  describe('Create and Read', () => {
    it('should create function group and verify by reading', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_group', 'test_function_group');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_function_group.test_function_group is disabled');
        return;
      }

      functionGroupName = testCase.params.function_group_name;
      packageName = testCase.params.package_name;

      // Create function group
      await createFunctionGroup(connection, {
        function_group_name: functionGroupName,
        description: testCase.params.description,
        package_name: packageName,
      });
      console.log(`✅ Created function group: ${functionGroupName}`);

      // Read to verify
      const result = await getFunctionGroup(connection, functionGroupName);
      expect(result.status).toBe(200);
      console.log(`✅ Read function group successfully: ${functionGroupName}`);
    }, 30000);

    it('should create function module and verify by reading', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_function_module.test_function_module is disabled');
        return;
      }

      functionModuleName = testCase.params.function_module_name;
      functionGroupName = testCase.params.function_group_name;
      packageName = testCase.params.package_name;
      sourceCode = testCase.params.source_code;

      // Create function module
      await createFunctionModule(connection, {
        function_module_name: functionModuleName,
        function_group_name: functionGroupName,
        description: testCase.params.description,
        source_code: sourceCode,
      });
      console.log(`✅ Created function module: ${functionModuleName}`);

      // Read to verify
      const result = await getFunction(connection, functionModuleName, functionGroupName);
      expect(result.status).toBe(200);
      expect(result.data).toContain('FUNCTION');
      console.log(`✅ Read function module successfully: ${functionModuleName}`);
    }, 30000);
  });

  describe('Update', () => {
    it('should update function module source code', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('update_function_module_source', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case update_function_module_source.test_function_module is disabled');
        return;
      }

      functionModuleName = testCase.params.function_module_name;
      functionGroupName = testCase.params.function_group_name;
      updatedSourceCode = testCase.params.source_code;

      await updateFunctionModuleSource(connection, {
        function_module_name: functionModuleName,
        function_group_name: functionGroupName,
        source_code: updatedSourceCode,
        activate: testCase.params.activate ?? true,
      });
      console.log(`✅ Updated function module source: ${functionModuleName}`);
    }, 30000);

    it('should read updated version after update', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('get_function_test', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case get_function_test.test_function_module is disabled');
        return;
      }

      const result = await getFunction(
        connection,
        testCase.params.function_module_name,
        testCase.params.function_group_name
      );
      expect(result.status).toBe(200);
      expect(result.data).toContain('Updated Result');
      console.log(`✅ Verified updated source contains "Updated Result"`);
    }, 10000);
  });

  describe('Check', () => {
    it('should check function module syntax', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('check_function_module', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case check_function_module.test_function_module is disabled');
        return;
      }

      const { generateSessionId } = await import('../../utils/sessionUtils');
      const sessionId = generateSessionId();

      const result = await checkFunctionModule(
        connection,
        testCase.params.function_group,
        testCase.params.function_name,
        testCase.params.version || 'active',
        sessionId
      );
      expect(result.status).toBe(200);
      console.log(`✅ Checked function module syntax: ${testCase.params.function_name}`);
    }, 10000);
  });

  describe('Live Validation', () => {
    it('should validate correct unsaved source code', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_function_module.test_function_module is disabled');
        return;
      }

      const validSource = `FUNCTION z_test_validation_fm
  IMPORTING
    VALUE(IV_INPUT) TYPE STRING
  EXPORTING
    VALUE(EV_OUTPUT) TYPE STRING.
  ev_output = |Valid: { iv_input }|.
ENDFUNCTION.`;

      const { generateSessionId } = await import('../../utils/sessionUtils');
      const sessionId = generateSessionId();

      const result = await validateFunctionModuleSource(
        connection,
        testCase.params.function_group_name,
        'Z_TEST_VALIDATION_FM',
        validSource,
        'active',
        sessionId
      );
      expect(result.status).toBe(200);
      console.log(`✅ Validated correct function module source`);
    }, 10000);

    it('should detect syntax errors in unsaved source code', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_function_module.test_function_module is disabled');
        return;
      }

      const invalidSource = `FUNCTION z_test_validation_fm
  IMPORTING
    VALUE(IV_INPUT) TYPE STRING
  EXPORTING
    VALUE(EV_OUTPUT) TYPE STRING.
  THIS IS INVALID SYNTAX.
ENDFUNCTION.`;

      const { generateSessionId } = await import('../../utils/sessionUtils');
      const sessionId = generateSessionId();

      // Should throw error due to invalid syntax
      await expect(
        validateFunctionModuleSource(
          connection,
          testCase.params.function_group_name,
          'Z_TEST_VALIDATION_FM',
          invalidSource,
          'active',
          sessionId
        )
      ).rejects.toThrow();
      console.log(`✅ Invalid source code detected correctly`);
    }, 10000);
  });

  describe('Delete', () => {
    it('should delete function module and verify deletion', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('delete_function_module', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case delete_function_module.test_function_module is disabled');
        return;
      }

      const functionModuleName = testCase.params.object_name;
      const functionGroupName = testCase.params.function_group_name;

      await deleteObject(connection, {
        object_name: functionModuleName,
        object_type: testCase.params.object_type,
        function_group_name: functionGroupName,
      });
      console.log(`✅ Deleted function module: ${functionModuleName}`);

      // Verify deletion - should throw error
      try {
        await getFunction(connection, functionModuleName, functionGroupName);
        throw new Error('Function module should not exist after deletion');
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log(`✅ Verified function module deletion: ${functionModuleName}`);
      }
    }, 30000);

    it('should delete function group and verify deletion', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('delete_function_group', 'test_function_group');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case delete_function_group.test_function_group is disabled');
        return;
      }

      const functionGroupName = testCase.params.object_name;

      await deleteObject(connection, {
        object_name: functionGroupName,
        object_type: testCase.params.object_type,
      });
      console.log(`✅ Deleted function group: ${functionGroupName}`);

      // Verify deletion - should throw error
      try {
        await getFunctionGroup(connection, functionGroupName);
        throw new Error('Function group should not exist after deletion');
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
        console.log(`✅ Verified function group deletion: ${functionGroupName}`);
      }
    }, 30000);
  });
});
