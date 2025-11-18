/**
 * Unit test for Program lock/unlock operations
 * Tests lockProgram and unlockProgram functions
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/program/lock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { lockProgram } from '../../../core/program/lock';
import { unlockProgram } from '../../../core/program/unlock';
import { getProgramMetadata } from '../../../core/program/read';
import { createProgram } from '../../../core/program/create';
import { activateProgram } from '../../../core/program/activation';
import { updateProgramSource } from '../../../core/program/update';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, markAuthFailed, hasAuthFailed, getConfig } from '../../helpers/sessionConfig';
import { registerTestLock, unregisterTestLock } from '../../helpers/lockHelper';
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

const logger = createTestLogger('Program - Lock/Unlock');

const TEST_SUITE_NAME = 'Program - Lock/Unlock';

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let lockHandle: string | null = null;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
  let testCase: any = null;
  let programName: string | null = null;

  beforeEach(async () => {
    lockHandle = null;
    testCase = null;
    programName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Lock/Unlock test', 'Authentication failed in previous test');
      return;
    }

    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);

      // Setup session and lock tracking
      const env = await setupTestEnvironment(connection, 'program_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      lockTracking = env.lockTracking;

      if (lockTracking?.enabled) {
        logger.debug(`✓ Lock tracking enabled: ${lockTracking.locksDir}`);
      }

      // Connect to SAP system (triggers auth & auto-refresh)
      await (connection as any).connect();

      hasConfig = true;

      // Prepare test case
      const tc = getEnabledTestCase('create_program', 'test_program');
      if (!tc) {
        logger.skip('Lock/Unlock test', 'Test case not enabled in test-config.yaml');
        testCase = null;
        programName = null;
        return;
      }

      testCase = tc;
      programName = tc.params.program_name;

      // Ensure program exists before test
      await ensureProgramExists(tc);

    } catch (error: any) {
      logger.error('❌ Authentication/Connection failed - marking all tests to skip');
      logger.error(`   Error: ${error.message}`);
      markAuthFailed(TEST_SUITE_NAME);
      hasConfig = false;
      testCase = null;
      programName = null;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
    lockHandle = null;
    testCase = null;
    programName = null;
  });

  async function ensureProgramExists(testCase: any) {
    const programName = testCase.params.program_name;

    try {
      await getProgramMetadata(connection, programName);
      logger.debug(`Program ${programName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Program ${programName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_program', 'test_program');
        if (!createTestCase) {
          throw new Error(`Cannot create program ${programName}: create_program test case not found`);
        }

        const sourceCode = createTestCase.params.source_code || `REPORT ${programName}.

WRITE: 'Hello World'.`;

        const sessionId = generateSessionId();

        // Step 1: Create program object (metadata only)
        await createProgram(connection, {
          program_name: programName,
          description: `Test program for ${programName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          source_code: sourceCode
        });

        // Step 2: Lock program
        lockHandle = await lockProgram(connection, programName, sessionId);

        // Step 3: Update source code
        await updateProgramSource(connection, {
          program_name: programName,
          source_code: sourceCode,
          activate: false
        });

        // Step 4: Unlock program
        await unlockProgram(connection, programName, lockHandle, sessionId);
        lockHandle = null;

        // Step 5: Activate program
        await activateProgram(connection, programName, sessionId);

        logger.debug(`Program ${programName} created and activated successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should lock and unlock program', async () => {
    if (!testCase || !programName) {
      return; // Already logged in beforeEach
    }

    try {
      validateTestCaseForUserSpace(testCase, 'create_program');
    } catch (error: any) {
      logger.skip('Lock/Unlock test', error.message);
      return;
    }

    const testSessionId = sessionId || generateSessionId();

    // Lock program
    lockHandle = await lockProgram(
      connection,
      programName,
      testSessionId
    );
    expect(lockHandle).toBeDefined();
    expect(lockHandle).not.toBe('');

    // Register lock in persistent storage
    if (lockTracking?.enabled) {
      registerTestLock(
        'program',
        programName,
        testSessionId,
        lockHandle,
        undefined,
        __filename
      );
      logger.debug(`✓ Lock registered in ${lockTracking.locksDir}`);
    }

    // Unlock program
    try {
      await unlockProgram(
        connection,
        programName,
        lockHandle,
        testSessionId
      );
      lockHandle = null;

      // Unregister lock from persistent storage
      if (lockTracking?.enabled) {
        unregisterTestLock('program', programName);
        logger.debug(`✓ Lock unregistered from ${lockTracking.locksDir}`);
      }
    } catch (error) {
      logger.error(`Failed to unlock program: ${error}`);
      throw error;
    }
  }, getTimeout('test'));
});
