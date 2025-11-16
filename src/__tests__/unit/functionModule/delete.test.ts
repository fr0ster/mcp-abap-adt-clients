/**
 * Unit test for deleteObject (Function Module)
 * Tests only the delete operation in isolation
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionModule/delete.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { deleteObject } from '../../../core/delete';
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunction } from '../../../core/functionModule/read';
import { getFunctionGroup } from '../../../core/functionGroup/read';

const { getEnabledTestCase } = require('../../../../tests/test-helper');

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};


describe('Function Module - Delete', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, 'functionModule_delete', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
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
    // Try different possible field names from YAML
    const functionModuleName = testCase.params?.function_module_name ||
                               testCase.params?.test_function_module_name ||
                               testCase.params?.object_name;
    const functionGroupName = testCase.params?.function_group_name ||
                             testCase.params?.test_function_group_name;

    if (!functionModuleName || !functionGroupName) {
      // If not found in testCase, try to get from create_function_module
      const createTestCase = getEnabledTestCase('create_function_module');
      if (createTestCase) {
        const fmName = createTestCase.params?.function_module_name;
        const fgName = createTestCase.params?.function_group_name;
        if (fmName && fgName) {
          // Use create test case params
          return await ensureFunctionModuleExists({
            params: {
              function_module_name: fmName,
              function_group_name: fgName,
              description: createTestCase.params?.description,
              package_name: createTestCase.params?.package_name,
              source_code: createTestCase.params?.source_code,
            }
          });
        }
      }
      throw new Error('function_module_name and function_group_name are required in test case');
    }

    try {
      await getFunction(connection, functionGroupName, functionModuleName);
      logger.debug(`Function module ${functionModuleName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function module ${functionModuleName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_function_module');
        if (createTestCase) {
    try {
      await createFunctionModule(connection, {
        function_module_name: functionModuleName,
        function_group_name: functionGroupName,
              description: createTestCase.params?.description || `Test FM for ${functionModuleName}`,
              package_name: createTestCase.params?.package_name,
              source_code: createTestCase.params?.source_code,
      });
            logger.debug(`Function module ${functionModuleName} created successfully`);
          } catch (createError: any) {
            // S_ABPLNGVS error means function module name violates SAP naming rules
            // (must start with Z_ or Y_ for non-SAP/non-partner users)
            if (createError.message.includes('S_ABPLNGVS')) {
              logger.warn(`⚠️ Skipping test: ${createError.message} (Function module name must start with Z_ or Y_ for non-SAP/non-partner users)`);
              throw createError; // Re-throw to skip test
            }
            throw createError;
          }
        } else {
          throw new Error(`Cannot create function module ${functionModuleName}: create_function_module test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should delete function module', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('delete_function_module') || getEnabledTestCase('create_function_module');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    const functionModuleName = testCase.params?.function_module_name || testCase.params?.test_function_module_name || testCase.params?.object_name;
    const functionGroupName = testCase.params?.function_group_name || testCase.params?.test_function_group_name;
    const packageName = testCase.params?.package_name;
    const objectType = testCase.params?.object_type || 'FUGR/FF';

    if (!functionModuleName || !functionGroupName) {
      return; // Skip silently if required params missing
    }

    // Ensure function group exists (idempotency)
    await ensureFunctionGroupExists(functionGroupName, packageName);

    // Ensure function module exists before test (idempotency)
    try {
      await ensureFunctionModuleExists(testCase);
    } catch (error: any) {
      // S_ABPLNGVS error means function module name violates SAP naming rules
      if (error.message.includes('S_ABPLNGVS') || error.response?.status >= 500) {
        return; // Skip test if name violates naming rules or server error
      }
      throw error;
    }

    // Delete FM
    await deleteObject(connection, {
      object_name: functionModuleName,
      object_type: objectType,
      function_group_name: functionGroupName,
    });

    logger.debug(`✅ Deleted function module: ${functionModuleName}`);

    // Verify deletion
    try {
      await getFunction(connection, functionGroupName, functionModuleName);
      throw new Error('FM should have been deleted but still exists');
    } catch (error: any) {
      // Expected - FM should not exist
      if (error.message.includes('should have been deleted')) {
        throw error;
      }
      if (error.response?.status === 404) {
        logger.debug(`✅ Verified FM deletion`);
      } else {
        throw error;
      }
    }
  }, 30000);
});
