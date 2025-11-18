/**
 * Integration test for Structure update
 * Tests updateStructure function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/structure/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateStructure } from '../../../core/structure/update';
import { getStructureMetadata } from '../../../core/structure/read';
import { createStructure } from '../../../core/structure/create';
import { lockStructure } from '../../../core/structure/lock';
import { unlockStructure } from '../../../core/structure/unlock';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Structure - Update';
const logger = createTestLogger('STRUCT-UPDATE');

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

    const env = await setupTestEnvironment(connection, 'structure_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('update_structure');
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
    const strName = testCase.params.structure_name;

    try {
      await getStructureMetadata(connection, strName);
      logger.debug(`Structure ${strName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Structure ${strName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_structure', 'test_structure');
        if (!createTestCase) {
          throw new Error(`Cannot create structure ${strName}: create_structure test case not found`);
        }

        await createStructure(connection, {
          structure_name: strName,
          description: createTestCase.params.description || `Test structure for ${strName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          fields: createTestCase.params.fields
        });
        logger.debug(`Structure ${strName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should update structure', async () => {
    if (!testCase || !structureName) {
      logger.skip('Update Test', testCase ? 'Structure name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update for structure: ${structureName}`);

    const updateSessionId = generateSessionId();
    let lockHandle: string | null = null;

    try {
      await ensureStructureExists(testCase);

      lockHandle = await lockStructure(connection, structureName, updateSessionId);
      logger.debug(`✓ Structure ${structureName} locked`);

      await updateStructure(connection, {
        structure_name: structureName,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        fields: testCase.params.fields
      }, lockHandle, updateSessionId);
      logger.debug(`✓ Structure ${structureName} updated`);

      const result = await getStructureMetadata(connection, structureName);
      expect(result.status).toBe(200);
      logger.info(`✓ Structure ${structureName} updated successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to update structure: ${error.message}`);
      throw error;
    } finally {
      if (lockHandle) {
        try {
          await unlockStructure(connection, structureName, lockHandle, updateSessionId);
          logger.debug(`✓ Structure ${structureName} unlocked`);
        } catch (error) {
          logger.debug(`⚠️ Unlock error ignored`);
        }
      }
    }
  }, getTimeout('test'));
});
