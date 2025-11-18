/**
 * Integration test for Structure syntax check
 * Tests checkStructure function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/structure/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkStructure } from '../../../core/structure/check';
import { getStructureMetadata } from '../../../core/structure/read';
import { createStructure } from '../../../core/structure/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Structure - Check';
const logger = createTestLogger('STRUCT-CHECK');

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

    const env = await setupTestEnvironment(connection, 'structure_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_structure');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_structure');
    } catch (error: any) {
      logger.skip('Test', error.message);
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
      if (error.response?.status === 404) {
        logger.debug(`Structure ${sName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_structure', 'test_structure');
        if (!createTestCase) {
          throw new Error(`Cannot create structure ${sName}: create_structure test case not found`);
        }

        await createStructure(connection, {
          structure_name: sName,
          description: createTestCase.params.description || `Test structure for ${sName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          fields: createTestCase.params.fields || [
            {
              name: 'FIELD1',
              description: 'Test field 1',
              data_type: 'CHAR',
              length: 10
            }
          ]
        });
        logger.debug(`Structure ${sName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should check structure syntax (active version)', async () => {
    if (!testCase || !structureName) {
      logger.skip('Check Test', testCase ? 'Structure name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for structure (active): ${structureName}`);

    try {
      await ensureStructureExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkStructure(connection, structureName, 'active', checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Structure ${structureName} syntax check (active) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check structure syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should check structure syntax (inactive version)', async () => {
    if (!testCase || !structureName) {
      logger.skip('Check Test', testCase ? 'Structure name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for structure (inactive): ${structureName}`);

    try {
      await ensureStructureExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkStructure(connection, structureName, 'inactive', checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Structure ${structureName} syntax check (inactive) completed`);

    } catch (error: any) {
      logger.error(`✗ Failed to check structure syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
