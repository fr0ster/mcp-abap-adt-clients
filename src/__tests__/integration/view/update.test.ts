/**
 * Integration test for View update
 * Tests updateViewSource function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/view/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateViewSource } from '../../../core/view/update';
import { getViewMetadata } from '../../../core/view/read';
import { createView } from '../../../core/view/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'View - Update';
const logger = createTestLogger('VIEW-UPDATE');

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

    const env = await setupTestEnvironment(connection, 'view_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('update_view_source');
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

  it('should update view', async () => {
    if (!testCase || !viewName) {
      logger.skip('Update Test', testCase ? 'View name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update for view: ${viewName}`);

    try {
      await ensureViewExists(testCase);

      await updateViewSource(connection, {
        view_name: viewName,
        ddl_source: testCase.params.ddl_source,
        activate: testCase.params.activate || false
      });
      logger.debug(`✓ View ${viewName} updated`);

      const result = await getViewMetadata(connection, viewName);
      expect(result.status).toBe(200);
      logger.info(`✓ View ${viewName} updated successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to update view: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
