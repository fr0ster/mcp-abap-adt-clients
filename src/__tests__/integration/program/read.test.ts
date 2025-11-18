/**
 * Integration test for Program read
 * Tests getProgramMetadata and getProgramSource functions (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/program/read.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { getProgramMetadata, getProgramSource } from '../../../core/program/read';
import { createProgram } from '../../../core/program/create';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Program - Read';
const logger = createTestLogger('PROG-READ');

describe(TEST_SUITE_NAME, () => {
  let connection: AbapConnection;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockTracking: { enabled: boolean; locksDir: string; autoCleanup: boolean } | null = null;
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
    testCase = null;
    programName = null;

    if (hasAuthFailed(TEST_SUITE_NAME)) {
      logger.skip('Test', 'Authentication failed in previous test');
      return;
    }

    const env = await setupTestEnvironment(connection, 'program_read', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('read_program');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'read_program');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    programName = tc.params.program_name;
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

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

  it('should read program metadata', async () => {
    if (!testCase || !programName) {
      logger.skip('Read Test', testCase ? 'Program name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read metadata for program: ${programName}`);

    try {
      await ensureProgramExists(testCase);

      const result = await getProgramMetadata(connection, programName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      logger.info(`✓ Program ${programName} metadata read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read program metadata: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should read program source code', async () => {
    if (!testCase || !programName) {
      logger.skip('Read Test', testCase ? 'Program name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing read source for program: ${programName}`);

    try {
      await ensureProgramExists(testCase);

      const result = await getProgramSource(connection, programName);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(typeof result.data).toBe('string');
      logger.info(`✓ Program ${programName} source read successfully`);

    } catch (error: any) {
      logger.error(`✗ Failed to read program source: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
