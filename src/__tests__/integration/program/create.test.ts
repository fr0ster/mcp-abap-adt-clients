/**
 * Integration test for Program creation
 * Tests createProgram function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/program/create.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { createProgram } from '../../../core/program/create';
import { getProgramMetadata } from '../../../core/program/read';
import { deleteProgram } from '../../../core/program/delete';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Program - Create';
const logger = createTestLogger('PROG-CREATE');

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

    const env = await setupTestEnvironment(connection, 'program_create', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('create_program');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'create_program');
    } catch (error: any) {
      logger.skip('Test', error.message);
      return;
    }

    testCase = tc;
    programName = tc.params.program_name;

    // Delete if exists (idempotency)
    if (programName) {
      await deleteIfExists(programName);
    }
  });

  afterEach(async () => {
    // Cleanup created program
    if (programName) {
      await deleteIgnoringErrors(programName);
    }
    await cleanupTestEnvironment(connection, sessionId, testConfig);
  });

  async function deleteIfExists(name: string): Promise<void> {
    try {
      await getProgramMetadata(connection, name);
      logger.debug(`Program ${name} exists, deleting...`);
      await deleteProgram(connection, { program_name: name });
      const delay = 2000;
      await new Promise(resolve => setTimeout(resolve, delay));
      logger.debug(`Program ${name} deleted`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Program ${name} does not exist (OK)`);
      } else {
        throw error;
      }
    }
  }

  async function deleteIgnoringErrors(name: string): Promise<void> {
    try {
      await deleteProgram(connection, { program_name: name });
      logger.debug(`Cleanup: deleted program ${name}`);
    } catch (error: any) {
      logger.debug(`Cleanup: could not delete program ${name} (${error.message})`);
    }
  }

  it('should create basic program', async () => {
    if (!testCase || !programName) {
      logger.skip('Create Test', testCase ? 'Program name not set' : 'Test case not configured');
      return;
    }

    logger.debug(`Testing create for program: ${programName}`);

    try {
      const result = await createProgram(connection, {
        program_name: testCase.params.program_name,
        description: testCase.params.description,
        package_name: testCase.params.package_name || getDefaultPackage(),
        transport_request: testCase.params.transport_request || getDefaultTransport(),
        program_type: testCase.params.program_type || '1'
      });

      expect([200, 201]).toContain(result.status);
      logger.debug(`✓ Program ${programName} created successfully (status: ${result.status})`);

      // Wait for SAP to register the object
      const delay = 1000;
      await new Promise(resolve => setTimeout(resolve, delay));

      // Verify program exists
      const getResult = await getProgramMetadata(connection, programName);
      expect(getResult.status).toBe(200);
      logger.debug(`✓ Program ${programName} verified to exist`);

    } catch (error: any) {
      logger.error(`✗ Failed to create program: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
