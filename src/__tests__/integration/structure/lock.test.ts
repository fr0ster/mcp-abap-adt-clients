/**
 * Unit test for Structure locking
 * Tests lockStructure function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/structure/lock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { lockStructure } from '../../../core/structure/lock';
import { unlockStructure } from '../../../core/structure/unlock';
import { getStructureMetadata } from '../../../core/structure/read';
import { createStructure } from '../../../core/structure/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, markAuthFailed, hasAuthFailed, getConfig } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const logger = createTestLogger('Structure - Lock/Unlock');

const TEST_SUITE_NAME = 'Structure - Lock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let structureName: string | null = null;

  beforeAll(async () => {
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      await (connection as any).connect();
      hasConfig = true;
    } catch (error: any) {
      logger.error('❌ Authentication/Connection failed - marking all tests to skip');
      logger.error(`   Error: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
  });

  beforeEach(async () => {
    lockHandle = null;
    testCase = null;
    structureName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    if (!hasConfig) {
      return;
    }

    try {
      const env = await setupTestEnvironment(connection, 'structure_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      const tc = getEnabledTestCase('lock_structure', 'test_structure_lock');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        structureName = null;
        return;
      }

      testCase = tc;
      structureName = tc.params.structure_name;
    } catch (error: any) {
      logger.error('Setup failed:', error.message);
      testCase = null;
      structureName = null;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    sessionId = null;
    testConfig = null;
    lockTracking = null;
  });

  async function ensureStructureExists(testCase: any) {
    const structureName = testCase.params.structure_name;

    try {
      await getStructureMetadata(connection, structureName);
      logger.debug(`Structure ${structureName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Structure ${structureName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_structure', 'test_structure');
        if (createTestCase) {
          try {
            await createStructure(connection, {
              structure_name: structureName,
              description: createTestCase.params.description || `Test structure for ${structureName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              fields: createTestCase.params.fields
            });
            logger.debug(`Structure ${structureName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create structure ${structureName}: create_structure test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should lock structure and get lock handle', async () => {
    if (!testCase || !structureName) {
      return; // Already logged in beforeEach
    }

    await ensureStructureExists(testCase);

    const testSessionId = sessionId || generateSessionId();
    lockHandle = await lockStructure(
      connection,
      structureName,
      testSessionId
    );

    expect(lockHandle).toBeDefined();
    expect(typeof lockHandle).toBe('string');
    expect(lockHandle.length).toBeGreaterThan(0);

    // Note: Structure locks not tracked in lock registry (not supported by lockHelper)

    // Unlock after test
    try {
      await unlockStructure(connection, structureName, lockHandle, testSessionId);
      lockHandle = null;
      logger.debug(`✓ Structure unlocked successfully`);
    } catch (error) {
      logger.error(`Failed to unlock structure: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});
