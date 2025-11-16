/**
 * Unit test for Class creation
 * Tests createClass function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/create.test
 *
 * IDEMPOTENCY PRINCIPLE:
 * Tests are designed to be idempotent - they can be run multiple times without manual cleanup.
 * - CREATE tests: Before creating an object, check if it exists and DELETE it if found.
 *   This ensures the test always starts from a clean state (object doesn't exist).
 *
 * All tests use only user-defined objects (Z_ or Y_ prefix) for modification operations.
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createClass } from '../../../core/class/create';
import { deleteObject } from '../../../core/delete';
import { validateClassName } from '../../../core/class/validation';
import { activateClass } from '../../../core/class/activation';
import { lockClass } from '../../../core/class/lock';
import { unlockClass } from '../../../core/class/unlock';
import { updateClass } from '../../../core/class/update';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getAllEnabledTestCases, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

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

describe('Class - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      // Setup session and lock tracking based on test-config.yaml
      // This will enable stateful session if persist_session: true in YAML
      const env = await setupTestEnvironment(connection, 'class_create', __filename);
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

  afterEach(async () => {
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
      connection.reset();
    }
  });

  /**
   * Delete class if it exists
   * Uses validateClassName to check existence (Eclipse-like approach)
   * Returns true if class was deleted or doesn't exist, false if deletion failed
   */
  async function deleteClassIfExists(className: string, packageName: string, maxRetries: number = 3): Promise<boolean> {
    if (!connection || !hasConfig) {
      return false;
    }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if class exists using validation (Eclipse approach)
        const validationResult = await validateClassName(connection, className, packageName);

        // If validation says class already exists, delete it
        // Check for various error messages indicating class exists
        const classExistsError = !validationResult.valid && validationResult.message &&
            (validationResult.message.toLowerCase().includes('already exists') ||
             validationResult.message.toLowerCase().includes('does already exist') ||
             validationResult.message.toLowerCase().includes('resource') && validationResult.message.toLowerCase().includes('exist'));

        if (classExistsError) {
          logger.debug(`Class ${className} exists (validation: ${validationResult.message}), deleting... (attempt ${attempt}/${maxRetries})`);

          try {
            await deleteObject(connection, {
              object_name: className,
              object_type: 'CLAS/OC',
            });
          } catch (deleteError: any) {
            // If deletion fails with "locked" or "dependency" error, wait and retry
            const errorMessage = deleteError.message || '';
            const errorData = typeof deleteError.response?.data === 'string'
              ? deleteError.response.data
              : JSON.stringify(deleteError.response?.data || '');

            if (attempt < maxRetries && (
              errorMessage.includes('locked') ||
              errorMessage.includes('dependency') ||
              errorData.includes('locked') ||
              errorData.includes('dependency')
            )) {
              logger.debug(`Class ${className} is locked or has dependencies, waiting and retrying...`);
              await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
              continue;
            }
            throw deleteError;
          }

          // Wait for deletion to process
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Verify deletion using validation
          const verifyResult = await validateClassName(connection, className, packageName);
          const stillExistsError = !verifyResult.valid && verifyResult.message &&
              (verifyResult.message.toLowerCase().includes('already exists') ||
               verifyResult.message.toLowerCase().includes('does already exist') ||
               verifyResult.message.toLowerCase().includes('resource') && verifyResult.message.toLowerCase().includes('exist'));
          if (stillExistsError) {
            if (attempt < maxRetries) {
              logger.debug(`Class ${className} still exists after deletion, retrying...`);
              await new Promise(resolve => setTimeout(resolve, 1000));
              continue;
            }
            logger.warn(`Class ${className} still exists after deletion`);
            return false;
          }
          logger.debug(`Class ${className} deleted successfully`);
          return true;
        } else {
          // Class doesn't exist (validation passed or different error)
          logger.debug(`Class ${className} does not exist (validation: ${validationResult.valid ? 'valid' : validationResult.message})`);
          return true;
        }
      } catch (error: any) {
        // 401 - no cookies yet, assume doesn't exist
        if (error.response?.status === 401) {
          logger.debug(`Class ${className} check failed with 401 (no cookies yet) - assuming doesn't exist`);
          return true;
        }

        // Other error - can't check/delete
        if (attempt < maxRetries) {
          logger.debug(`Failed to check/delete class ${className}, retrying... (attempt ${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        logger.warn(`Failed to check/delete class ${className}: ${error.message}`);
        return false;
      }
    }

    return false;
  }


  it('should create class', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const allTestCases = getAllEnabledTestCases('create_class');
    if (allTestCases.length === 0) {
      logger.warn('⚠️ Skipping test: No test cases enabled');
      return;
    }

    // Process all enabled test cases
    for (const testCase of allTestCases) {
      // Validate user space (Z_ or Y_ prefix)
      try {
        validateTestCaseForUserSpace(testCase, 'create_class');
      } catch (error: any) {
        logger.warn(`⚠️ Skipping test case ${testCase.params.class_name}: ${error.message}`);
        continue;
      }

      const className = testCase.params.class_name;
      const superclass = testCase.params.superclass;
      const packageName = testCase.params.package_name || getDefaultPackage();

      // Delete class if exists (using validation to check existence, Eclipse-like)
      // This is critical for CREATE test - we must ensure class doesn't exist before creating
      const deleted = await deleteClassIfExists(className, packageName);
      if (!deleted) {
        logger.warn(`⚠️ Failed to ensure class ${className} doesn't exist, skipping test case`);
        continue; // Skip this test case if we can't ensure clean state
      }

      // Validate class name and superclass via ADT endpoint
      const validationResult = await validateClassName(
        connection,
        className,
        packageName,
        testCase.params.description,
        superclass
      );

      if (!validationResult.valid) {
        // If validation says class already exists, it means deletion failed
        if (validationResult.message?.toLowerCase().includes('already exists')) {
          logger.warn(`⚠️ Class ${className} still exists after deletion attempt, skipping test case`);
          continue;
        }
        throw new Error(`Class validation failed: ${validationResult.message || 'Invalid class name or superclass'}`);
      }

      // Final check before creation: try to delete one more time if class exists
      // This ensures we have a clean state right before creation
      const finalDeleteResult = await deleteClassIfExists(className, packageName, 1);
      if (!finalDeleteResult) {
        logger.warn(`⚠️ Final deletion attempt failed for class ${className}, skipping test case`);
        continue;
      }

      // Create class workflow: create -> lock -> update -> unlock -> activate
      // Always generate a new UUID for ADT requests (sessionId from setupTestEnvironment is for file storage, not ADT requests)
      const testSessionId = generateSessionId();

      await createClass(connection, {
        class_name: className,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        superclass: superclass,
        final: testCase.params.final,
      });

      const lockHandle = await lockClass(connection, className, testSessionId);
      if (!testCase.params.source_code) {
        throw new Error('source_code is required in test case');
      }
      await updateClass(connection, className, testCase.params.source_code, lockHandle, testSessionId, testCase.params.transport_request || getDefaultTransport());
      await unlockClass(connection, className, lockHandle, testSessionId);
      await activateClass(connection, className, testSessionId);
    }
  }, 60000);
});


