/**
 * Integration test for Class update
 * Tests updateClass function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/class/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateClass } from '../../../core/class/update';
import { getClass } from '../../../core/class/read';
import { createClass } from '../../../core/class/create';
import { lockClass } from '../../../core/class/lock';
import { unlockClass } from '../../../core/class/unlock';
import { activateClass } from '../../../core/class/activation';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Class - Update';
const logger = createTestLogger('CLASS-UPDATE');

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

    const env = await setupTestEnvironment(connection, 'class_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('update_class');
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
    const clsName = testCase.params.class_name;

    try {
      await getClass(connection, clsName);
      logger.debug(`Class ${clsName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Class ${clsName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_class', 'test_class');
        if (!createTestCase) {
          throw new Error(`Cannot create class ${clsName}: create_class test case not found`);
        }

        const sourceCode = createTestCase.params.source_code;
        if (!sourceCode) {
          throw new Error(`source_code is required for creating class ${clsName}`);
        }

        const updateSessionId = generateSessionId();

        await createClass(connection, {
          class_name: clsName,
          description: testCase.params.description || `Test class for ${clsName}`,
          package_name: createTestCase.params.package_name,
        });

        const lockHandle = await lockClass(connection, clsName, updateSessionId);
        await updateClass(connection, clsName, sourceCode, lockHandle, updateSessionId, createTestCase.params.transport_request);
        await unlockClass(connection, clsName, lockHandle, updateSessionId);
        await activateClass(connection, clsName, updateSessionId);

        logger.debug(`Class ${clsName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should update class source code', async () => {
    if (!testCase || !className) {
      logger.skip('Update Test', testCase ? 'Class name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing update for class: ${className}`);

    try {
      await ensureClassExists(testCase);

      const updatedSourceCode = `CLASS ${className} DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
    METHODS: get_updated_text RETURNING VALUE(rv_text) TYPE string.
ENDCLASS.

CLASS ${className} IMPLEMENTATION.
  METHOD get_updated_text.
    rv_text = 'Updated Text'.
  ENDMETHOD.
ENDCLASS.`;

      const updateSessionId = generateSessionId();

      const lockHandle = await lockClass(connection, className, updateSessionId);
      logger.debug(`✓ Class ${className} locked`);

      await updateClass(connection, className, updatedSourceCode, lockHandle, updateSessionId, testCase.params.transport_request);
      logger.debug(`✓ Class ${className} updated`);

      await unlockClass(connection, className, lockHandle, updateSessionId);
      logger.debug(`✓ Class ${className} unlocked`);

      await activateClass(connection, className, updateSessionId);
      logger.debug(`✓ Class ${className} activated`);

      const result = await getClass(connection, className, 'inactive');
      expect(result.status).toBe(200);
      expect(result.data).toContain('Updated Text');
      logger.debug(`✓ Class ${className} updated successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to update class: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
