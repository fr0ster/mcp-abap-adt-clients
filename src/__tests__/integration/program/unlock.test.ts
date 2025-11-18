/**
 * Integration test for Program unlock
 * Tests unlockProgram function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/program/unlock.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { lockProgram } from '../../../core/program/lock';
import { unlockProgram } from '../../../core/program/unlock';
import { getProgramMetadata } from '../../../core/program/read';
import { createProgram } from '../../../core/program/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Program - Unlock';
const logger = createTestLogger('PROG-UNLOCK');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;

  // Suite-level test case data
  let testCase: any = null;
  let programName: string | null = null;

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
    programName = null;

    // Check for auth failures first
    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    // Setup test environment
    const env = await setupTestEnvironment(connection, 'program_unlock', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('unlock_program');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    testCase = tc;
    programName = tc.params.program_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  /**
   * Ensure program exists before test
   */
  async function ensureProgramExists(testCase: any): Promise<void> {
    const progName = testCase.params.program_name;

    try {
      await getProgramMetadata(connection, progName);
      logger.debug(`Program ${progName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Program ${progName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_program', 'test_program');
        if (!createTestCase) {
          throw new Error(`Cannot create program ${progName}: create_program test case not found`);
        }

        await createProgram(connection, {
          program_name: progName,
          description: createTestCase.params.description || `Test program for ${progName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          source_code: createTestCase.params.source_code
        });
        logger.debug(`Program ${progName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should unlock program', async () => {
    // Skip if no test case configured
    if (!testCase || !programName) {
      logger.skip('Unlock Test', testCase ? 'Program name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing unlock for program: ${programName}`);

    try {
      // Ensure program exists
      await ensureProgramExists(testCase);

      // Lock program first
      const lockHandle = await lockProgram(connection, programName, sessionId || '');
      expect(lockHandle).toBeDefined();
      logger.debug(`✓ Acquired lock handle: ${lockHandle}`);

      // Unlock program
      const result = await unlockProgram(connection, programName, lockHandle, sessionId || '');
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Program ${programName} unlocked successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to unlock program: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
