/**
 * Unit test for createFunctionModule
 * Tests only the create operation in isolation
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { deleteObject } from '../../../core/delete';
import { getFunction } from '../../../core/functionModule/read';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

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

describe('Function Module - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;

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

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  it('should create function module', async () => {
    if (!hasConfig) {
      console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
    if (!testCase) {
      console.warn('⚠️ Skipping test: Test case create_function_module.test_function_module is disabled');
      return;
    }

    const functionModuleName = testCase.params.function_module_name;
    const functionGroupName = testCase.params.function_group_name;
    const packageName = testCase.params.package_name;
    const sourceCode = testCase.params.source_code;

    // 1. Ensure FUGR exists (create if not exists)
    try {
      await getFunctionGroup(connection, functionGroupName);
      console.log(`ℹ️  FUGR ${functionGroupName} already exists`);
    } catch (error) {
      console.log(`ℹ️  Creating FUGR ${functionGroupName}...`);
      const fugrTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
      await createFunctionGroup(connection, {
        function_group_name: functionGroupName,
        description: fugrTestCase?.params.description || 'Test FUGR for FM unit test',
        package_name: packageName,
      });
    }

    // 2. Delete FM if it already exists (idempotency - delete without checking)
    try {
      await deleteObject(connection, {
        object_name: functionModuleName,
        object_type: testCase.params.object_type,
        function_group_name: functionGroupName,
      });
      console.log(`ℹ️  Deleted existing FM ${functionModuleName}`);
    } catch (error: any) {
      // FM doesn't exist or can't be deleted - ignore error
      console.log(`ℹ️  FM ${functionModuleName} doesn't exist or already deleted`);
    }

    // 3. Create FM
    try {
      await createFunctionModule(connection, {
        function_module_name: functionModuleName,
        function_group_name: functionGroupName,
        description: testCase.params.description,
        package_name: packageName,
        source_code: sourceCode,
      });

      console.log(`✅ Created function module: ${functionModuleName}`);

      // 4. Verify creation
      const result = await getFunction(connection, functionGroupName, functionModuleName);
      expect(result.status).toBe(200);
      expect(result.data).toContain(functionModuleName);
      console.log(`✅ Verified FM creation`);
    } catch (error: any) {
      if (error.message.includes('S_ABPLNGVS')) {
        console.warn(`⚠️  Skipping create test: Missing S_ABPLNGVS authorization`);
        return;
      }
      throw error;
    }
  }, 30000);
});
