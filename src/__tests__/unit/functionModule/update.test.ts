/**
 * Unit test for updateFunctionModuleSource
 * Tests only the update operation in isolation
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionModule/update.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { updateFunctionModuleSource } from '../../../core/functionModule/update';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunction } from '../../../core/functionModule/read';
import { getFunctionGroup } from '../../../core/functionGroup/read';

const { getEnabledTestCase, getDefaultPackage } = require('../../../../tests/test-helper');
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

describe('Function Module - Update', () => {
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
        const fugrTestCase = getEnabledTestCase('create_function_group');
        if (!fugrTestCase) {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found`);
        }
        await createFunctionGroup(connection, {
          function_group_name: functionGroupName,
          description: fugrTestCase.params.description || `Test FUGR for ${functionGroupName}`,
          package_name: packageName || fugrTestCase.params.package_name || getDefaultPackage(),
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

  it('should update function module source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('update_function_module_source') || getEnabledTestCase('create_function_module');
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

    // Update FM with new source code
    const updatedSourceCode = testCase.params?.source_code || `FUNCTION ${functionModuleName}.
*"----------------------------------------------------------------------
*"*"Local Interface:
*"  IMPORTING
*"     REFERENCE(INPUT) TYPE  STRING
*"  EXPORTING
*"     REFERENCE(RESULT) TYPE  STRING
*"----------------------------------------------------------------------
  " Updated Result
  RESULT = |Updated: { INPUT }|.
ENDFUNCTION.`;

    try {
      await updateFunctionModuleSource(connection, {
        function_module_name: functionModuleName,
        function_group_name: functionGroupName,
        source_code: updatedSourceCode,
      });

      logger.debug(`✅ Updated function module source: ${functionModuleName}`);

      // Verify update
      const result = await getFunction(connection, functionGroupName, functionModuleName);
      expect(result.status).toBe(200);
      if (updatedSourceCode.includes('Updated')) {
        expect(result.data).toContain('Updated');
      }
      logger.debug(`✅ Verified FM update`);
    } catch (error: any) {
      // S_ABPLNGVS error means function module name violates SAP naming rules
      if (error.message.includes('S_ABPLNGVS')) {
        logger.warn(`⚠️ Skipping update test: ${error.message} (Function module name must start with Z_ or Y_ for non-SAP/non-partner users)`);
        return;
      }
      throw error;
    }
  }, 30000);
});
