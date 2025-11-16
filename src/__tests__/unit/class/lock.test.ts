/**
 * Unit test for Class lock/unlock operations
 * Tests lockClass and unlockClass functions
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/lock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockClass } from '../../../core/class/lock';
import { unlockClass } from '../../../core/class/unlock';
import { getClassMetadata } from '../../../core/class/read';
import { createClass } from '../../../core/class/create';
import { activateClass } from '../../../core/class/activation';
import { updateClass } from '../../../core/class/update';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';

const { getEnabledTestCase, getDefaultPackage } = require('../../../../tests/test-helper');

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Class - Lock/Unlock', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    lockHandle = null;
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, 'class_lock', __filename);
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
    lockHandle = null;
  });

  // Helper function to ensure object exists before test (idempotency)
  async function ensureClassExists(testCase: any) {
    try {
      await getClassMetadata(connection, testCase.params.class_name);
      logger.debug(`Class ${testCase.params.class_name} exists`);
      return; // Object exists, nothing to do
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Object doesn't exist - create it
        logger.debug(`Class ${testCase.params.class_name} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_class');
        if (!createTestCase) {
          throw new Error(`Cannot create class ${testCase.params.class_name}: create_class test case not found`);
        }

        const sourceCode = createTestCase.params.source_code;
        if (!sourceCode) {
          throw new Error(`source_code is required for creating class ${testCase.params.class_name}`);
        }

        const className = testCase.params.class_name;

        // Step 1: Create class object (metadata only)
        await createClass(connection, {
          class_name: className,
          description: `Test class for ${className}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
        });

        // Step 2: Lock class
        const tempLockHandle = await lockClass(connection, className, sessionId!);

        // Step 3: Update source code
        await updateClass(
          connection,
          className,
          sourceCode,
          tempLockHandle,
          sessionId!,
          createTestCase.params.transport_request
        );

        // Step 4: Unlock class
        await unlockClass(connection, className, tempLockHandle, sessionId!);

        // Step 5: Activate class
        await activateClass(connection, className, sessionId!);

        logger.debug(`Class ${className} created and activated successfully`);
      } else {
        // Real error (not 404) - propagate it
        throw error;
      }
    }
  }

  it('should lock and unlock class', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    // Use create_class to ensure we test with user-created Z-class, not SAP system class
    const testCase = getEnabledTestCase('create_class');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    // Ensure class exists before test (idempotency)
    await ensureClassExists(testCase);

    // Lock class (should work for user-created Z-classes)
    lockHandle = await lockClass(
      connection,
      testCase.params.class_name,
      sessionId!
    );
    expect(lockHandle).toBeDefined();
    expect(lockHandle).not.toBe('');

    // Unlock class
    await unlockClass(
      connection,
      testCase.params.class_name,
      lockHandle,
      sessionId!
    );
  }, 20000);
});
