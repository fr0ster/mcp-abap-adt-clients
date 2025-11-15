/**
 * Unit test for createFunctionGroup
 * Tests only the create operation in isolation
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionGroup/create.test
 *
 * IDEMPOTENCY PRINCIPLE:
 * Tests are designed to be idempotent - they can be run multiple times without manual cleanup.
 * - CREATE tests: Before creating an object, check if it exists and DELETE it if found.
 *   This ensures the test always starts from a clean state (object doesn't exist).
 * - Other tests (READ, UPDATE, DELETE, CHECK, ACTIVATE, LOCK, UNLOCK): Before testing,
 *   check if the object exists and CREATE it if missing. This ensures the test has
 *   the required object available.
 *
 * All tests use only user-defined objects (Z_ or Y_ prefix) for modification operations.
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { deleteObject } from '../../../core/delete';
import { getFunctionGroup } from '../../../core/functionGroup/read';

const { getEnabledTestCase, validateTestCaseForUserSpace } = require('../../../../tests/test-helper');
// Environment variables are loaded automatically by test-helper

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

describe('Function Group - Create', () => {
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

  // Helper function to ensure object does not exist before creation test (idempotency)
  async function ensureFunctionGroupDoesNotExist(testCase: any): Promise<boolean> {
    if (!connection || !hasConfig) {
      logger.warn('⚠️ Connection not initialized, skipping ensureFunctionGroupDoesNotExist');
      return false;
    }
    try {
      await getFunctionGroup(connection, testCase.params.function_group_name);
      // Object exists, try to delete it
      logger.debug(`Function group ${testCase.params.function_group_name} exists, attempting to delete...`);
      try {
        await deleteObject(connection, {
          object_name: testCase.params.function_group_name,
          object_type: 'FUGR/F',
        });
        logger.debug(`Function group ${testCase.params.function_group_name} deleted successfully`);
        // Wait a bit for SAP to process deletion
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Verify it's truly gone - try a few times as SAP may have delay
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await getFunctionGroup(connection, testCase.params.function_group_name);
            // Object still exists, wait a bit more and try again
            if (attempt < 2) {
              logger.debug(`Function group ${testCase.params.function_group_name} still exists, waiting... (attempt ${attempt + 1}/3)`);
              await new Promise(resolve => setTimeout(resolve, 2000));
            } else {
              // After 3 attempts, object still exists - might be locked or has dependencies
              logger.warn(`Function group ${testCase.params.function_group_name} still exists after deletion attempt (may be locked or have dependencies)`);
              // Still proceed - deletion was successful, SAP may just need more time
              return true;
            }
          } catch (verifyError: any) {
            if (verifyError.response?.status === 404) {
              logger.debug(`Function group ${testCase.params.function_group_name} confirmed deleted`);
              return true; // Successfully deleted
            }
            throw verifyError;
          }
        }
        return true; // Proceed even if object still exists - deletion was successful
      } catch (deleteError: any) {
        logger.warn(`Failed to delete function group ${testCase.params.function_group_name}: ${deleteError.message}`);
        return false; // Cannot proceed - deletion failed
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${testCase.params.function_group_name} does not exist`);
        return true; // Object doesn't exist - can proceed
      }
      throw error;
    }
  }

  it('should create function group', async () => {
    if (!hasConfig || !connection) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_function_group');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    // Validate that function group is in user space (Z_ or Y_)
    try {
      validateTestCaseForUserSpace(testCase, 'create_function_group');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    // Ensure function group does not exist before creation (idempotency)
    // This will delete the object if it exists
    const canProceed = await ensureFunctionGroupDoesNotExist(testCase);
    if (!canProceed) {
      logger.warn(`⚠️ Skipping test: Cannot ensure function group ${testCase.params.function_group_name} does not exist`);
      return;
    }

    // Final verification that object doesn't exist
    try {
      await getFunctionGroup(connection, testCase.params.function_group_name);
      logger.warn(`⚠️ Function group ${testCase.params.function_group_name} still exists, skipping creation test`);
      return;
    } catch (error: any) {
      if (error.response?.status !== 404) {
        throw error;
      }
      // Object doesn't exist - proceed with creation
    }

    const functionGroupName = testCase.params.function_group_name;
    const packageName = testCase.params.package_name;

    await createFunctionGroup(connection, {
      function_group_name: functionGroupName,
      description: testCase.params.description,
      package_name: packageName,
    });

    logger.debug(`✅ Created function group: ${functionGroupName}`);
  }, 30000);
});
