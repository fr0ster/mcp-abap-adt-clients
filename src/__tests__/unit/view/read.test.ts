/**
 * Unit test for View reading
 * Tests getView function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/view/read.test
 */

import { getViewMetadata, getViewSource } from '../../../core/view/read';
import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { createView } from '../../../core/view/create';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('View - Read', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_read', __filename);
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
    try {
      await getViewMetadata(connection, testCase.params.view_name);
      logger.debug(`View ${testCase.params.view_name} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`View ${testCase.params.view_name} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_view');
        if (createTestCase) {
          await createView(connection, {
            view_name: testCase.params.view_name,
            description: createTestCase.params.description,
            package_name: createTestCase.params.package_name || getDefaultPackage(),
            transport_request: createTestCase.params.transport_request || getDefaultTransport(),
            ddl_source: createTestCase.params.ddl_source
          });
          logger.debug(`View ${testCase.params.view_name} created successfully`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should read existing view', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_view');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    await ensureViewExists(testCase);

    const result = await getViewMetadata(connection, testCase.params.view_name);
    expect(result.status).toBe(200);
  }, 15000);

  it('should read view source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_view');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    await ensureViewExists(testCase);

    const result = await getViewSource(connection, testCase.params.view_name);
    expect(result.status).toBe(200);
    expect(typeof result.data).toBe('string');
  }, 15000);
});

