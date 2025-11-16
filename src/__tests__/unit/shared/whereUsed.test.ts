/**
 * Unit test for getWhereUsed shared function
 * Tests getWhereUsed function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/whereUsed.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { getWhereUsed } from '../../../core/shared/whereUsed';

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};


describe('Shared - getWhereUsed', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_whereUsed', __filename);
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

  it('should get where-used for class', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const result = await getWhereUsed(connection, {
      object_name: 'CL_ABAP_CHAR_UTILITIES',
      object_type: 'class'
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should get where-used for table', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const result = await getWhereUsed(connection, {
      object_name: 'T000',
      object_type: 'table'
    });
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should throw error if object name is missing', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    await expect(
      getWhereUsed(connection, {
        object_name: '',
        object_type: 'class'
      })
    ).rejects.toThrow('Object name is required');
  });

  it('should throw error if object type is missing', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    await expect(
      getWhereUsed(connection, {
        object_name: 'TEST',
        object_type: ''
      })
    ).rejects.toThrow('Object type is required');
  });
});

