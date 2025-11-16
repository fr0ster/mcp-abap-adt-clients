/**
 * Unit test for searchObjects shared function
 * Tests searchObjects function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/search.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { searchObjects } from '../../../core/shared/search';

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};


describe('Shared - searchObjects', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_search', __filename);
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

  it('should search objects by name pattern', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const result = await searchObjects(connection, {
      query: 'CL_ABAP*',
      maxResults: 10
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should search objects with object type filter', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const result = await searchObjects(connection, {
      query: 'T*',
      objectType: 'TABL',
      maxResults: 10
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should use default maxResults if not provided', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const result = await searchObjects(connection, {
      query: 'CL_ABAP*'
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);
});

