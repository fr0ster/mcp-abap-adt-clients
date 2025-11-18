/**
 * Integration test for Program update
 * Tests updateProgramSource function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/program/update.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { updateProgramSource } from '../../../core/program/update';
import { getProgramMetadata } from '../../../core/program/read';
import { createProgram } from '../../../core/program/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Program - Update';
const logger = createTestLogger('PROG-UPDATE');

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
    const env = await setupTestEnvironment(connection, 'program_update', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    // Get test case
    const tc = getEnabledTestCase('update_program');
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

        const sourceCode = createTestCase.params.source_code || `REPORT ${progName}.

WRITE: 'Hello World'.`;

        await createProgram(connection, {
          program_name: progName,
          description: `Test program for ${progName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          source_code: sourceCode
        });
        logger.debug(`Program ${progName} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should update program source code', async () => {
    // Skip if no test case configured
    if (!testCase || !programName) {
      logger.skip('Update Test', testCase ? 'Program name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing update for program: ${programName}`);

    try {
      // Ensure program exists
      await ensureProgramExists(testCase);

      const updatedSourceCode = testCase.params.source_code || `REPORT ${programName}.

WRITE: 'Updated Hello World'.`;

      // Update program
      const result = await updateProgramSource(connection, {
        program_name: programName,
        source_code: updatedSourceCode,
        activate: false
      });
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      logger.info(`✓ Program ${programName} updated successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to update program: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
