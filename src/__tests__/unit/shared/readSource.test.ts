/**
 * Unit test for readSource shared function
 * Tests readObjectSource function for different object types
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/readSource.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { readObjectSource, supportsSourceCode } from '../../../core/shared/readSource';

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};


describe('Shared - readSource', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_readSource', __filename);
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

  it('should check if object type supports source code', () => {
    expect(supportsSourceCode('class')).toBe(true);
    expect(supportsSourceCode('program')).toBe(true);
    expect(supportsSourceCode('interface')).toBe(true);
    expect(supportsSourceCode('table')).toBe(true);
    expect(supportsSourceCode('structure')).toBe(true);
    expect(supportsSourceCode('view')).toBe(true);
    expect(supportsSourceCode('domain')).toBe(false);
    expect(supportsSourceCode('dataelement')).toBe(false);
  });

  it('should read class source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    // Use a standard SAP class that should exist
    const className = 'CL_ABAP_CHAR_UTILITIES';
    const result = await readObjectSource(connection, 'class', className);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');
  }, 15000);

  it('should read class source code (inactive version)', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const className = 'CL_ABAP_CHAR_UTILITIES';
    const result = await readObjectSource(connection, 'class', className, undefined, 'inactive');
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);

  it('should throw error for object type without source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    await expect(
      readObjectSource(connection, 'domain', 'MANDT')
    ).rejects.toThrow('does not support source code reading');
  });
});

