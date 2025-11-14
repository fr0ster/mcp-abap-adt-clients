/**
 * Unit test for Function Module validation
 * Tests validateFunctionModuleName and validateFunctionModuleSource
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { validateFunctionModuleName, validateFunctionModuleSource } from '../../../core/functionModule/validation';
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

describe('Function Module - Validate', () => {
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

  describe('Name Validation', () => {
    it('should validate free (non-existing) function module name', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_function_module.test_function_module is disabled');
        return;
      }

      // Use unique name that doesn't exist
      const uniqueName = `Z_TEST_FM_${Date.now().toString().slice(-6)}`;

      const validationResult = await validateFunctionModuleName(
        connection,
        testCase.params.function_group_name,
        uniqueName,
        'Test FM for validation'
      );

      logger.debug(`Free name validation (${uniqueName}):`, JSON.stringify(validationResult, null, 2));

      // Free name should return: valid=true, severity=OK
      expect(validationResult.valid).toBe(true);
      expect(['OK', 'SUCCESS', '']).toContain(validationResult.severity);
    }, 10000);

    it('should detect already existing function module name', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_function_module.test_function_module is disabled');
        return;
      }

      // Use name that already exists (from previous tests)
      const existingName = testCase.params.function_module_name; // Z_OK_TEST_FM_01

      const validationResult = await validateFunctionModuleName(
        connection,
        testCase.params.function_group_name,
        existingName,
        testCase.params.description
      );

      logger.debug(`Existing name validation (${existingName}):`, JSON.stringify(validationResult, null, 2));

      // Existing name should return: valid=false OR severity=ERROR
      const hasError = !validationResult.valid || validationResult.severity === 'ERROR';
      expect(hasError).toBe(true);
      expect(validationResult.message).toContain('already exists');
    }, 10000);

    it('should detect SAP-reserved function module name', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_function_module.test_function_module is disabled');
        return;
      }

      // Invalid name - SAP reserved (no Z_/Y_ prefix)
      const reservedName = 'INVALID_FM_NAME';

      const validationResult = await validateFunctionModuleName(
        connection,
        testCase.params.function_group_name,
        reservedName,
        'Invalid test FM'
      );

      logger.debug(`Reserved name validation (${reservedName}):`, JSON.stringify(validationResult, null, 2));

      // Reserved name should return: valid=true with WARNING, or valid=false with ERROR
      // For us: WARNING/ERROR = validation failed
      const hasWarningOrError = validationResult.severity === 'WARNING' ||
                                 validationResult.severity === 'ERROR' ||
                                 !validationResult.valid;

      expect(hasWarningOrError).toBe(true);
    }, 10000);
  });

  describe('Source Code Validation', () => {
    it('should validate existing function module source code', async () => {
      if (!hasConfig) {
        console.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        console.warn('⚠️ Skipping test: Test case create_function_module.test_function_module is disabled');
        return;
      }

      const functionGroupName = testCase.params.function_group_name;
      const functionModuleName = testCase.params.function_module_name; // Z_OK_TEST_FM_01 - existing FM

      // Validate existing FM without passing source code (no artifacts)
      try {
        const response = await validateFunctionModuleSource(
          connection,
          functionGroupName,
          functionModuleName
          // No sourceCode parameter - validates existing FM in SAP
        );

        expect(response.status).toBe(200);
      } catch (error: any) {
        // Should not throw for valid existing FM
        throw new Error(`Validation should pass for existing FM: ${error.message}`);
      }
    }, 15000);
  });
});
