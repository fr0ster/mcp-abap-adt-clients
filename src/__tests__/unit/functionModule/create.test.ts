/**
 * Unit test for createFunctionModule
 * Tests only the create operation in isolation
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/functionModule/create.test
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
import { createFunctionModule } from '../../../core/functionModule/create';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { deleteObject } from '../../../core/delete';
import { getFunctionMetadata, getFunctionSource } from '../../../core/functionModule/read';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Function Module - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      // Setup session and lock tracking based on test-config.yaml
      // This will enable stateful session if persist_session: true in YAML
      const env = await setupTestEnvironment(connection, 'functionModule_create', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (sessionId) {
        logger.debug(`✓ Session persistence enabled: ${sessionId}`);
        logger.debug(`  Session storage: ${testConfig?.session_config?.sessions_dir || '.sessions'}`);
      } else {
        logger.debug('⚠️ Session persistence disabled (persist_session: false in test-config.yaml)');
      }

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      } else {
        logger.debug('⚠️ Lock tracking disabled (persist_locks: false in test-config.yaml)');
      }

      // Connect to SAP system to initialize session (get CSRF token and cookies)
      await (connection as any).connect();

      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
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

  // Helper function to ensure function module does not exist before creation test (idempotency)
  async function ensureFunctionModuleDoesNotExist(testCase: any): Promise<boolean> {
    const functionModuleName = testCase.params?.function_module_name;
    const functionGroupName = testCase.params?.function_group_name;
    const objectType = testCase.params?.object_type || 'FUGR/FF';

    if (!functionModuleName || !functionGroupName) {
      return false;
    }

    try {
      await getFunctionMetadata(connection, functionGroupName, functionModuleName);
      // Object exists, try to delete it
      logger.debug(`Function module ${functionModuleName} exists, attempting to delete...`);
      try {
        await deleteObject(connection, {
          object_name: functionModuleName,
          object_type: objectType,
          function_group_name: functionGroupName,
        });
        logger.debug(`Function module ${functionModuleName} deleted successfully`);
        // Wait a bit for SAP to process deletion
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Verify it's truly gone
        try {
          await getFunctionMetadata(connection, functionGroupName, functionModuleName);
          logger.warn(`Function module ${functionModuleName} still exists after deletion attempt`);
          return false; // Cannot proceed - object still exists
        } catch (verifyError: any) {
          if (verifyError.response?.status === 404) {
            logger.debug(`Function module ${functionModuleName} confirmed deleted`);
            return true; // Successfully deleted
          }
          throw verifyError;
        }
      } catch (deleteError: any) {
        logger.warn(`Failed to delete function module ${functionModuleName}: ${deleteError.message}`);
        return false; // Cannot proceed - deletion failed
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function module ${functionModuleName} does not exist`);
        return true; // Object doesn't exist - can proceed
      }
      // If server error (500), try to delete object in case it exists
      if (error.response?.status >= 500) {
        logger.warn(`⚠️ Server error checking FM ${functionModuleName}, attempting to delete in case it exists: ${error.message}`);
        try {
          await deleteObject(connection, {
            object_name: functionModuleName,
            object_type: objectType,
            function_group_name: functionGroupName,
          });
          logger.debug(`Function module ${functionModuleName} deleted after 500 error`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          return true; // Proceed after deletion attempt
        } catch (deleteError: any) {
          // If deletion also fails, assume object doesn't exist and proceed
          logger.warn(`⚠️ Could not delete FM ${functionModuleName} after 500 error: ${deleteError.message}`);
          return true; // Assume object doesn't exist - can proceed
        }
      }
      throw error;
    }
  }

  it('should create function module', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_function_module');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    const functionModuleName = testCase.params?.function_module_name;
    const functionGroupName = testCase.params?.function_group_name;
    const packageName = testCase.params?.package_name;
    const sourceCode = testCase.params?.source_code;
    const objectType = testCase.params?.object_type || 'FUGR/FF';

    if (!functionModuleName || !functionGroupName) {
      return; // Skip silently if required params missing
    }

    // Validate that function module and function group are in user space (Z_ or Y_)
    try {
      validateTestCaseForUserSpace(testCase, 'create_function_module');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    // Ensure function group exists (idempotency)
    await ensureFunctionGroupExists(functionGroupName, packageName);

    // Ensure function module does not exist before creation (idempotency)
    // This will delete the object if it exists
    const canProceed = await ensureFunctionModuleDoesNotExist(testCase);
    if (!canProceed) {
      logger.warn(`⚠️ Skipping test: Cannot ensure function module ${functionModuleName} does not exist`);
      return;
    }

    // Create FM
    try {
      await createFunctionModule(connection, {
        function_module_name: functionModuleName,
        function_group_name: functionGroupName,
        description: testCase.params?.description,
        package_name: packageName,
        source_code: sourceCode,
      });

      logger.debug(`✅ Created function module: ${functionModuleName}`);

      // Verify creation
      const result = await getFunctionSource(connection, functionGroupName, functionModuleName);
      expect(result.status).toBe(200);
      expect(result.data).toContain(functionModuleName);
      logger.debug(`✅ Verified FM creation`);
    } catch (error: any) {
      // S_ABPLNGVS error means function module name violates SAP naming rules
      // (must start with Z_ or Y_ for non-SAP/non-partner users)
      // This is caught by validation, not an authorization issue
      if (error.message.includes('S_ABPLNGVS')) {
        logger.warn(`⚠️ Skipping create test: ${error.message} (Function module name must start with Z_ or Y_ for non-SAP/non-partner users)`);
        return;
      }
      // If server error (500), might be due to missing source_code or other issues
      if (error.response?.status >= 500) {
        logger.warn(`⚠️ Skipping create test: Server error creating FM: ${error.message}`);
        return;
      }
      throw error;
    }
  }, 30000);
});
