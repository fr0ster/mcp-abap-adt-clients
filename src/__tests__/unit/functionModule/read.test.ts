/**
 * Unit test for getFunction (read FM)
 * Tests only the read operation in isolation
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { getFunction } from '../../../core/functionModule/read';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
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

describe('Function Module - Read', () => {
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

  it('should read function module', async () => {
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

    // 1. Ensure FUGR exists
    try {
      await getFunctionGroup(connection, functionGroupName);
    } catch (error) {
      console.log(`ℹ️  Creating FUGR ${functionGroupName}...`);
      const fugrTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
      await createFunctionGroup(connection, {
        function_group_name: functionGroupName,
        description: fugrTestCase?.params.description || 'Test FUGR',
        package_name: packageName,
      });
    }

    // 2. Ensure FM exists (create if not, ignore if exists)
    try {
      await createFunctionModule(connection, {
        function_module_name: functionModuleName,
        function_group_name: functionGroupName,
        description: testCase.params.description,
        package_name: packageName,
        source_code: testCase.params.source_code,
      });
      console.log(`ℹ️  Created FM ${functionModuleName}`);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log(`ℹ️  FM ${functionModuleName} already exists`);
      } else if (error.message.includes('S_ABPLNGVS')) {
        console.warn(`⚠️  Skipping read test: Missing S_ABPLNGVS authorization to create FM`);
        return;
      } else {
        throw error;
      }
    }

    // 3. Read FM
    const result = await getFunction(connection, functionGroupName, functionModuleName);
    expect(result.status).toBe(200);
    expect(result.data).toContain(functionModuleName);
    console.log(`✅ Read function module successfully: ${functionModuleName}`);
  }, 10000);
});
