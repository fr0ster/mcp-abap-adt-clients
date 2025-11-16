/**
 * Unit test for readMetadata shared function
 * Tests readObjectMetadata function for different object types
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/readMetadata.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { readObjectMetadata } from '../../../core/shared/readMetadata';

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};


describe('Shared - readMetadata', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_readMetadata', __filename);
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

  it('should read class metadata', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    // Use a standard SAP class that should exist
    const className = 'CL_ABAP_CHAR_UTILITIES';
    const result = await readObjectMetadata(connection, 'class', className);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should read domain metadata', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    // Use a standard SAP domain that should exist
    const domainName = 'MANDT';
    const result = await readObjectMetadata(connection, 'domain', domainName);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should read table metadata', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    // Use a standard SAP table that should exist
    const tableName = 'T000';
    const result = await readObjectMetadata(connection, 'table', tableName);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should throw error for unsupported object type', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    await expect(
      readObjectMetadata(connection, 'unsupported_type', 'TEST')
    ).rejects.toThrow('Unsupported object type for metadata');
  });
});

