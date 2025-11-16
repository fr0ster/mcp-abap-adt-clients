/**
 * Unit test for Function Module validation
 * Tests validateFunctionModuleName and validateFunctionModuleSource
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionModule/validate.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { validateFunctionModuleName, validateFunctionModuleSource } from '../../../core/functionModule/validation';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunction } from '../../../core/functionModule/read';
import { getFunctionGroup } from '../../../core/functionGroup/read';

const { getEnabledTestCase } = require('../../../../tests/test-helper');
// Environment variables are loaded automatically by test-helper

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
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
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  // Helper function to ensure function group exists (idempotency)
  async function ensureFunctionGroupExists(functionGroupName: string, packageName?: string) {
    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const fugrTestCase = getEnabledTestCase('create_function_group', 'test_function_group');
        if (!fugrTestCase || !fugrTestCase.params.package_name) {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found or missing package_name`);
        }
        await createFunctionGroup(connection, {
          function_group_name: functionGroupName,
          description: fugrTestCase.params.description || `Test FUGR for ${functionGroupName}`,
          package_name: packageName || fugrTestCase.params.package_name,
        });
        logger.debug(`Function group ${functionGroupName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  // Helper function to ensure function module exists before test (idempotency)
  async function ensureFunctionModuleExists(testCase: any) {
    const functionModuleName = testCase.params?.function_module_name;
    const functionGroupName = testCase.params?.function_group_name;

    if (!functionModuleName || !functionGroupName) {
      throw new Error('function_module_name and function_group_name are required in test case');
    }

    try {
      await getFunction(connection, functionGroupName, functionModuleName);
      logger.debug(`Function module ${functionModuleName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function module ${functionModuleName} does not exist, creating...`);
        try {
          await createFunctionModule(connection, {
            function_module_name: functionModuleName,
            function_group_name: functionGroupName,
            description: testCase.params?.description,
            package_name: testCase.params?.package_name,
            source_code: testCase.params?.source_code,
          });
          logger.debug(`Function module ${functionModuleName} created successfully`);
        } catch (createError: any) {
          // S_ABPLNGVS error means function module name violates SAP naming rules
          // (must start with Z_ or Y_ for non-SAP/non-partner users)
          if (createError.message.includes('S_ABPLNGVS')) {
            logger.warn(`⚠️ Skipping test: ${createError.message} (Function module name must start with Z_ or Y_ for non-SAP/non-partner users)`);
            throw createError; // Re-throw to skip test
          }
          // If creation fails with 500 or other server error, log and re-throw
          // This might be due to missing source_code or other issues
          if (createError.response?.status >= 500) {
            logger.warn(`⚠️ Server error creating FM ${functionModuleName}: ${createError.message}`);
            throw createError; // Re-throw to skip test
          }
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  describe('Name Validation', () => {
    it('should validate free (non-existing) function module name', async () => {
      if (!hasConfig) {
        logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const functionGroupName = testCase.params?.function_group_name;
      if (!functionGroupName) {
        return; // Skip silently if required params missing
      }

      // Ensure function group exists (idempotency)
      await ensureFunctionGroupExists(functionGroupName, testCase.params?.package_name);

      // Use unique name that doesn't exist
      const timestamp = Date.now().toString().slice(-6);
      const uniqueName = `Z_TEST_FM_${timestamp}`.substring(0, 30); // FM name max 30 chars

      const validationResult = await validateFunctionModuleName(
        connection,
        functionGroupName,
        uniqueName,
        'Test FM for validation'
      );

      logger.debug(`Free name validation (${uniqueName}): valid=${validationResult.valid}, severity=${validationResult.severity}`);

      // Free name should return: valid=true (no ERROR)
      expect(validationResult.valid).toBe(true);
    }, 10000);

    it('should detect already existing function module name', async () => {
      if (!hasConfig) {
        logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const functionModuleName = testCase.params?.function_module_name;
      const functionGroupName = testCase.params?.function_group_name;
      const packageName = testCase.params?.package_name;

      if (!functionModuleName || !functionGroupName) {
        return; // Skip silently if required params missing
      }

      // Ensure function group exists (idempotency)
      await ensureFunctionGroupExists(functionGroupName, packageName);

      // Ensure function module exists (idempotency)
      try {
        await ensureFunctionModuleExists(testCase);
      } catch (error: any) {
        // S_ABPLNGVS error means function module name violates SAP naming rules
        if (error.message.includes('S_ABPLNGVS') || error.response?.status >= 500) {
          return; // Skip test if name violates naming rules or server error
        }
        throw error;
      }

      // Use name that already exists
      const validationResult = await validateFunctionModuleName(
        connection,
        functionGroupName,
        functionModuleName,
        testCase.params?.description
      );

      logger.debug(`Existing name validation (${functionModuleName}): valid=${validationResult.valid}, severity=${validationResult.severity}`);

      // Existing name should return: valid=false OR severity=ERROR/WARNING
      const hasError = !validationResult.valid || validationResult.severity === 'ERROR' || validationResult.severity === 'WARNING';
      expect(hasError).toBe(true);
    }, 10000);
  });

  describe('Source Code Validation', () => {
    it('should validate existing function module source code', async () => {
      if (!hasConfig) {
        logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
        return;
      }

      const testCase = getEnabledTestCase('create_function_module', 'test_function_module');
      if (!testCase) {
        return; // Skip silently if test case not configured
      }

      const functionModuleName = testCase.params?.function_module_name;
      const functionGroupName = testCase.params?.function_group_name;
      const packageName = testCase.params?.package_name;

      if (!functionModuleName || !functionGroupName) {
        return; // Skip silently if required params missing
      }

      // Ensure function group exists (idempotency)
      await ensureFunctionGroupExists(functionGroupName, packageName);

      // Ensure function module exists (idempotency)
      try {
        await ensureFunctionModuleExists(testCase);
      } catch (error: any) {
        // S_ABPLNGVS error means function module name violates SAP naming rules
        if (error.message.includes('S_ABPLNGVS') || error.response?.status >= 500) {
          return; // Skip test if name violates naming rules or server error
        }
        throw error;
      }

      // Validate existing FM without passing source code (no artifacts)
      try {
        const response = await validateFunctionModuleSource(
          connection,
          functionGroupName,
          functionModuleName,
          undefined, // No sourceCode parameter - validates existing FM in SAP
          'active'
        );

        expect(response.status).toBe(200);
        logger.debug(`✅ Validated existing FM source code`);
      } catch (error: any) {
        // Should not throw for valid existing FM (unless it has errors/warnings)
        throw new Error(`Validation should pass for existing FM: ${error.message}`);
      }
    }, 15000);
  });
});
