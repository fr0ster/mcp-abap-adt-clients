/**
 * Integration test for View syntax check
 * Tests checkView function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/view/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkView } from '../../../core/view/check';
import { getViewMetadata } from '../../../core/view/read';
import { createView } from '../../../core/view/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'View - Check';
const logger = createTestLogger('VIEW-CHECK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let viewName: string | null = null;

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
    viewName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'view_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_view');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_view');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    viewName = tc.params.view_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureViewExists(testCase: any): Promise<void> {
    const vName = testCase.params.view_name;

    try {
      await getViewMetadata(connection, vName);
      logger.debug(`View ${vName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`View ${vName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_view', 'test_view');
        if (!createTestCase) {
          throw new Error(`Cannot create view ${vName}: create_view test case not found`);
        }

        await createView(connection, {
          view_name: vName,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          ddl_source: createTestCase.params.ddl_source || createTestCase.params.ddl_code
        });
        logger.debug(`View ${vName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should check view syntax (active version)', async () => {
    if (!testCase || !viewName) {
      logger.skip('Check Test', testCase ? 'View name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for view (active): ${viewName}`);

    try {
      await ensureViewExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkView(connection, viewName, 'active', checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ View ${viewName} syntax check (active) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check view syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should check view syntax (inactive version)', async () => {
    if (!testCase || !viewName) {
      logger.skip('Check Test', testCase ? 'View name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for view (inactive): ${viewName}`);

    try {
      await ensureViewExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkView(connection, viewName, 'inactive', checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ View ${viewName} syntax check (inactive) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check view syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
