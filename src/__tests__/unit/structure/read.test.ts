/**
 * Unit test for Structure reading
 * Tests getStructure function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/structure/read.test
 */

import { getStructureMetadata, getStructureSource } from '../../../core/structure/read';
import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { createStructure } from '../../../core/structure/create';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Structure - Read', () => {
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

  async function ensureStructureExists(testCase: any) {
    try {
      await getStructureMetadata(connection, testCase.params.structure_name);
      logger.debug(`Structure ${testCase.params.structure_name} exists`);
    } catch (error: any) {
      // 404 or 406 means structure doesn't exist or cannot be read
      if (error.response?.status === 404 || error.response?.status === 406) {
        logger.debug(`Structure ${testCase.params.structure_name} does not exist (${error.response?.status}), creating...`);
        try {
          await createStructure(connection, {
            structure_name: testCase.params.structure_name,
            description: testCase.params.description || `Test structure for ${testCase.params.structure_name}`,
            package_name: testCase.params.package_name || getDefaultPackage(),
            transport_request: testCase.params.transport_request || getDefaultTransport(),
            fields: testCase.params.fields
          });
          logger.debug(`Structure ${testCase.params.structure_name} created successfully`);
          // Wait a bit for structure to be available
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (createError: any) {
          // If structure already exists, that's OK
          if (createError.message?.includes('already exists') ||
              createError.message?.includes('does already exist') ||
              (createError.response?.data &&
               typeof createError.response.data === 'string' &&
               createError.response.data.includes('already exists'))) {
            logger.debug(`Structure ${testCase.params.structure_name} already exists`);
            return;
          }
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  it('should read existing structure', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      await ensureStructureExists(testCase);
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: Cannot ensure structure exists: ${error.message}`);
      return;
    }

    const result = await getStructureMetadata(connection, testCase.params.structure_name);
    expect(result.status).toBe(200);
  }, 15000);

  it('should read structure source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      await ensureStructureExists(testCase);
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: Cannot ensure structure exists: ${error.message}`);
      return;
    }

    const result = await getStructureSource(connection, testCase.params.structure_name);
    expect(result.status).toBe(200);
    expect(typeof result.data).toBe('string');
  }, 15000);

  it('should read structure metadata', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      await ensureStructureExists(testCase);
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: Cannot ensure structure exists: ${error.message}`);
      return;
    }

    const result = await getStructureMetadata(connection, testCase.params.structure_name);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);
});

