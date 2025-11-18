/**
 * Integration test for Class syntax check
 * Tests checkClass function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/class/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkClass } from '../../../core/class/check';
import { getClass } from '../../../core/class/read';
import { createClass } from '../../../core/class/create';
import { activateClass } from '../../../core/class/activation';
import { lockClass } from '../../../core/class/lock';
import { unlockClass } from '../../../core/class/unlock';
import { updateClass } from '../../../core/class/update';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Class - Check';
const logger = createTestLogger('CLASS-CHECK');

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

    const env = await setupTestEnvironment(connection, 'class_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_class');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    if (!tc.params.sourceCode) {
      try {
        validateTestCaseForUserSpace(tc, 'check_class');
      } catch (error: any) {
        logger.skip('Test', error.message);
        return;
      }
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

        const sourceCode = testCase.params.source_code || createTestCase.params.source_code;
        if (!sourceCode) {
          throw new Error(`source_code is required for creating class ${cName}`);
        }

        const checkSessionId = generateSessionId();

        // Step 1: Create class object (metadata only)
        await createClass(connection, {
          class_name: cName,
          description: `Test class for ${cName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
        });

        // Step 2: Lock class
        const lockHandle = await lockClass(connection, cName, checkSessionId);

        // Step 3: Update source code
        await updateClass(
          connection,
          cName,
          sourceCode,
          lockHandle,
          checkSessionId,
          createTestCase.params.transport_request
        );

        // Step 4: Unlock class
        await unlockClass(connection, cName, lockHandle, checkSessionId);

        // Step 5: Activate class
        await activateClass(connection, cName, checkSessionId);

        logger.debug(`Class ${cName} created and activated successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should check active class', async () => {
    if (!testCase || !className) {
      logger.skip('Check Test', testCase ? 'Class name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing syntax check for class (active): ${className}`);

    if (!testCase.params.sourceCode) {
      try {
        await ensureClassExists(testCase);
      } catch (error: any) {
        logger.error(`✗ Failed to ensure class exists: ${error.message}`);
        throw error;
      }
    }

    try {
      const result = await checkClass(connection, className, 'active');
      expect(result.status).toBe(200);
      logger.debug(`✓ Class ${className} syntax check (active) completed`);
    } catch (error: any) {
      logger.error(`✗ Failed to check class syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should check inactive class', async () => {
    if (!testCase || !className) {
      logger.skip('Check Test', testCase ? 'Class name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing syntax check for class (inactive): ${className}`);

    try {
      await ensureClassExists(testCase);

      const result = await checkClass(connection, className, 'inactive');
      expect(result.status).toBe(200);
      logger.debug(`✓ Class ${className} syntax check (inactive) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check class syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should check hypothetical class code', async () => {
    if (!testCase) {
      logger.skip('Check Test', 'Test case not configured');
      return;
    }

    const hypotheticalCode = `CLASS ZCL_TEST_HYPOTHETICAL DEFINITION
  PUBLIC
  FINAL
  CREATE PUBLIC .

  PUBLIC SECTION.
    METHODS: test_method RETURNING VALUE(rv_result) TYPE string.
ENDCLASS.

CLASS ZCL_TEST_HYPOTHETICAL IMPLEMENTATION.
  METHOD test_method.
    rv_result = 'Test'.
  ENDMETHOD.
ENDCLASS.`;

    logger.debug('Testing syntax check for hypothetical class code');

    try {
      const result = await checkClass(connection, 'ZCL_TEST_HYPOTHETICAL', 'active', hypotheticalCode);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.debug('✓ Hypothetical class code syntax check completed');
    } catch (error: any) {
      if (error.message && error.message.includes('does not exist')) {
        logger.debug('⚠️ Hypothetical code check returned expected "does not exist" error');
        expect(error.message).toContain('ZCL_TEST_HYPOTHETICAL');
      } else {
        logger.error(`✗ Failed to check hypothetical class: ${error.message}`);
        throw error;
      }
    }
  }, getTimeout('test'));
});
