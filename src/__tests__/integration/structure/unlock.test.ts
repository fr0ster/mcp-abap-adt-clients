/**
 * Integration test for Structure unlock
 * Tests unlockStructure function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/structure/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockStructure } from '../../../core/structure/lock';
import { unlockStructure } from '../../../core/structure/unlock';
import { getStructureMetadata } from '../../../core/structure/read';
import { createStructure } from '../../../core/structure/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Structure - Unlock';
const logger = createTestLogger('STRUCT-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
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
    // Reset suite variables
    testCase = null;
    structureName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'structure_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_structure');
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

  /**
   * Ensure structure exists before test
   */
  async function ensureStructureExists(testCase: any): Promise<void> {
    const structName = testCase.params.structure_name;

    try {
      await getStructureMetadata(connection, structName);
      logger.debug(`Structure ${structName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Structure ${structName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_structure', 'test_structure');
        if (!createTestCase) {
          throw new Error(`Cannot create structure ${structName}: create_structure test case not found`);
        }

        await createStructure(connection, {
          structure_name: structName,
          description: createTestCase.params.description || `Test structure for ${structName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          fields: createTestCase.params.fields
        });
        logger.debug(`Structure ${structName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock structure', async () => {
    // Skip if no test case configured
    if (!testCase || !structureName) {
      logger.skip('Unlock Test', testCase ? 'Structure name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for structure: ${structureName}`);

    try {
      // Ensure structure exists
      await ensureStructureExists(testCase);

      // Lock structure first
      const lockHandle = await lockStructure(connection, structureName, sessionId || '');
      expect(lockHandle).toBeDefined();
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock structure
      const result = await unlockStructure(connection, structureName, lockHandle, sessionId || '');
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Structure ${structureName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock structure: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
