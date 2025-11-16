/**
 * Unit test for deleteObject (Function Group)
 * Tests only the delete operation in isolation
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { deleteObject } from '../../../core/delete';
import { createFunctionGroup } from '../../../core/functionGroup/create';
import { getFunctionGroup } from '../../../core/functionGroup/read';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getDefaultPackage } = require('../../../../tests/test-helper');

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

describe('Function Group - Delete', () => {
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
      const env = await setupTestEnvironment(connection, 'functionGroup_delete', __filename);
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

  // Helper function to ensure object exists before test (idempotency)
  async function ensureFunctionGroupExists(testCase: any) {
    const functionGroupName = testCase.params.function_group_name || testCase.params.test_function_group_name || testCase.params.object_name;
    if (!functionGroupName) {
      throw new Error('function_group_name, test_function_group_name, or object_name is required in test case');
    }
    try {
      await getFunctionGroup(connection, functionGroupName);
      logger.debug(`Function group ${functionGroupName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Function group ${functionGroupName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_function_group');
        if (createTestCase) {
          await createFunctionGroup(connection, {
            function_group_name: functionGroupName,
            description: testCase.params.description || `Test function group for ${functionGroupName}`,
            package_name: createTestCase.params.package_name || getDefaultPackage(),
          });
          logger.debug(`Function group ${functionGroupName} created successfully`);
        } else {
          throw new Error(`Cannot create function group ${functionGroupName}: create_function_group test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should delete function group', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('delete_function_group');
    if (!testCase) {
      return; // Skip silently if test case not configured
    }

    // Ensure function group exists before test (idempotency)
    await ensureFunctionGroupExists(testCase);

    const functionGroupName = testCase.params.function_group_name || testCase.params.test_function_group_name || testCase.params.object_name;
    const objectType = testCase.params.object_type || 'FUGR/F';

    await deleteObject(connection, {
      object_name: functionGroupName,
      object_type: objectType,
    });
    logger.debug(`✅ Deleted function group: ${functionGroupName}`);
  }, 10000);
});
