/**
 * Unit test for View update
 * Tests updateViewSource function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/view/update.test
 */

import { getViewMetadata } from '../../../core/view/read';
import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { updateViewSource } from '../../../core/view/update';
import { createView } from '../../../core/view/create';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('View - Update', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_update', __filename);
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
  });

  async function ensureViewExists(testCase: any) {
    const viewName = testCase.params.view_name;

    try {
      await getViewMetadata(connection, viewName);
      logger.debug(`View ${viewName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`View ${viewName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_view');
        if (createTestCase) {
          try {
            await createView(connection, {
              view_name: viewName,
              description: createTestCase.params.description || `Test view for ${viewName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              ddl_source: createTestCase.params.ddl_source
            });
            logger.debug(`View ${viewName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create view ${viewName}: create_view test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should update view', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('update_view_source');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'update_view_source');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureViewExists(testCase);

    await updateViewSource(connection, {
      view_name: testCase.params.view_name,
      ddl_source: testCase.params.ddl_source,
      activate: testCase.params.activate || false
    });

    // Verify update by reading
    const result = await getViewMetadata(connection, testCase.params.view_name);
    expect(result.status).toBe(200);
  }, 60000);
});

