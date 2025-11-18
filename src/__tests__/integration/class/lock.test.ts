/**
 * Integration test for Class lock/unlock operations
 * Tests lockClass and unlockClass functions
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/class/lock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockClass } from '../../../core/class/lock';
import { unlockClass } from '../../../core/class/unlock';
import { createClass } from '../../../core/class/create';
import { deleteObject } from '../../../core/delete';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Class - Lock/Unlock';
const logger = createTestLogger('CLASS-LOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let className: string;
  let packageName: string;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      // Setup session and lock tracking based on test-config.yaml
      const env = await setupTestEnvironment(connection, 'class_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;

      // Connect to SAP system to initialize session
      await (connection as any).connect();
      hasConfig = true;

      // Get test case params
      const testCase = getEnabledTestCase('create_class', 'test_class');
      if (!testCase) {
        throw new Error('Test case not enabled');
      }

      className = testCase.params.class_name;
      packageName = testCase.params.package_name;

      // Create class for testing (ignore if already exists or no rights)
      try {
        await createClass(connection, {
          class_name: className,
          description: `Test class for lock/unlock`,
          package_name: packageName,
        });
        logger.debug(`Class ${className} created`);
      } catch (error: any) {
        // Ignore 403 (no rights), 409 (already exists), etc
        if (error.response?.status === 403) {
          logger.debug(`No rights to create class, assuming ${className} exists`);
        } else {
          logger.debug(`Class ${className} already exists or error: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error('❌ Configuration/Connection failed');
      hasConfig = false;
    }
  }, 60000); // Add timeout for beforeAll

  afterAll(async () => {
    if (hasConfig && className) {
      // Delete test class
      try {
        await deleteObject(connection, {
          object_name: className,
          object_type: 'CLAS/OC',
        });
        logger.debug(`Class ${className} deleted`);
      } catch (error: any) {
        logger.warn(`Error deleting class: ${error.message}`);
      }
    }
    if (connection) {
      await cleanupTestEnvironment(connection, sessionId, testConfig);
      connection.reset();
    }
  });

  it('should lock and unlock class', async () => {
    if (!hasConfig) {
      logger.skip('Test', 'No config');
      return;
    }

    const sessionId = generateSessionId();
    let lockHandle: string | null = null;

    try {
      // Lock
      logger.debug(`Locking class: ${className}`);
      const lockResult = await lockClass(connection, className, sessionId);
      lockHandle = lockResult;

      expect(lockHandle).toBeDefined();
      expect(lockHandle).not.toBe('');
      logger.debug(`✓ Class locked: ${lockHandle}`);

    } finally {
      // Unlock (always in finally)
      if (lockHandle) {
        logger.debug(`Unlocking class: ${className}`);
        await unlockClass(connection, className, lockHandle, sessionId);
        logger.debug(`✓ Class unlocked`);
      }
    }
  }, getTimeout('test'));
});
