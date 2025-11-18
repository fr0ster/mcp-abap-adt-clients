/**
 * Integration test for Structure read
 * Tests getStructureMetadata and getStructureSource functions (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/structure/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getStructureSource, getStructureMetadata } from '../../../core/structure/read';
import { createStructure } from '../../../core/structure/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Structure - Read';
const logger = createTestLogger('STRUCT-READ');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let structureName: string | null = null;

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
    structureName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'structure_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('get_structure');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    structureName = tc.params.structure_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function ensureStructureExists(testCase: any): Promise<void> {
    const sName = testCase.params.structure_name;

    try {
      await getStructureMetadata(connection, sName);
      logger.debug(`Structure ${sName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 406) {
        logger.debug(`Structure ${sName} does not exist (${error.response?.status}), creating...`);
        try {
          await createStructure(connection, {
            structure_name: sName,
            description: testCase.params.description || `Test structure for ${sName}`,
            package_name: testCase.params.package_name || getDefaultPackage(),
            transport_request: testCase.params.transport_request || getDefaultTransport(),
            fields: testCase.params.fields
          });
          logger.debug(`Structure ${sName} created successfully`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (createError: any) {
          if (createError.message?.includes('already exists') ||
              createError.message?.includes('does already exist') ||
              (createError.response?.data &&
               typeof createError.response.data === 'string' &&
               createError.response.data.includes('already exists'))) {
            logger.debug(`Structure ${sName} already exists`);
            return;
          }
          throw createError;
        }
      } else {
        throw error;
      }
    }
  }

  it('should read structure metadata', async () => {
    if (!testCase || !structureName) {
      logger.skip('Read Test', testCase ? 'Structure name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read metadata for structure: ${structureName}`);

    try {
      await ensureStructureExists(testCase);

      const result = await getStructureMetadata(connection, structureName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      logger.info(`✓ Structure ${structureName} metadata read successfully`);

    } catch (error: any) {
      if (error.message?.includes('Cannot ensure structure exists')) {
        logger.skip('Read Test', error.message);
        return;
      }
      logger.error(`✗ Failed to read structure metadata: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should read structure source code', async () => {
    if (!testCase || !structureName) {
      logger.skip('Read Test', testCase ? 'Structure name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read source for structure: ${structureName}`);

    try {
      await ensureStructureExists(testCase);

      const result = await getStructureSource(connection, structureName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      logger.info(`✓ Structure ${structureName} source read successfully`);

    } catch (error: any) {
      if (error.message?.includes('Cannot ensure structure exists')) {
        logger.skip('Read Test', error.message);
        return;
      }
      logger.error(`✗ Failed to read structure source: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
