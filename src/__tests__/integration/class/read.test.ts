/**
 * Integration test for Class read
 * Tests getClass function with active and inactive versions (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/class/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getClass } from '../../../core/class/read';
import { createClass } from '../../../core/class/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Class - Read';
const logger = createTestLogger('CLASS-READ');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let className: string | null = null;

  beforeAll(async () => {
    const config = getConfig();
    connection = createAbapConnection(config, logger);
    await (connection as any).connect();
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  beforeEach(async () => {
    testCase = null;
    className = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'class_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('get_class');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    className = tc.params.class_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureClassExists(testCase: any): Promise<void> {
    const cName = testCase.params.class_name;

    try {
      await getClass(connection, cName);
      logger.debug(`Class ${cName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Class ${cName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_class', 'test_class');
        if (!createTestCase) {
          throw new Error(`Cannot create class ${cName}: create_class test case not found`);
        }

        await createClass(connection, {
          class_name: cName,
          description: testCase.params.description || `Test class for ${cName}`,
          package_name: createTestCase.params.package_name
        });
        logger.debug(`Class ${cName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should read class (active version)', async () => {
    if (!testCase || !className) {
      logger.skip('Read Test', testCase ? 'Class name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing read active version for class: ${className}`);

    try {
      await ensureClassExists(testCase);

      const result = await getClass(connection, className);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('CLASS');
      logger.debug(`✓ Class ${className} (active) read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read class: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should read class (inactive version)', async () => {
    if (!testCase || !className) {
      logger.skip('Read Test', testCase ? 'Class name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing read inactive version for class: ${className}`);

    try {
      await ensureClassExists(testCase);

      const result = await getClass(connection, className, 'inactive');
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data).toContain('CLASS');
      logger.debug(`✓ Class ${className} (inactive) read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read class: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
