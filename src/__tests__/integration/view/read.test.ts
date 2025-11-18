/**
 * Integration test for View read
 * Tests getViewMetadata and getViewSource functions (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/view/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getViewSource, getViewMetadata } from '../../../core/view/read';
import { createView } from '../../../core/view/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'View - Read';
const logger = createTestLogger('VIEW-READ');

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

    const env = await setupTestEnvironment(connection, 'view_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('get_view');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
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
          description: createTestCase.params.description || `Test view for ${vName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          ddl_source: createTestCase.params.ddl_source
        });
        logger.debug(`View ${vName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should read view metadata', async () => {
    if (!testCase || !viewName) {
      logger.skip('Read Test', testCase ? 'View name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read metadata for view: ${viewName}`);

    try {
      await ensureViewExists(testCase);

      const result = await getViewMetadata(connection, viewName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      logger.info(`✓ View ${viewName} metadata read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read view metadata: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should read view source code', async () => {
    if (!testCase || !viewName) {
      logger.skip('Read Test', testCase ? 'View name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read source for view: ${viewName}`);

    try {
      await ensureViewExists(testCase);

      const result = await getViewSource(connection, viewName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      logger.info(`✓ View ${viewName} source read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read view source: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
