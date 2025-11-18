/**
 * Integration test for Program syntax check
 * Tests checkProgram function (low-level)
 *
 * Enable logs: LOG_LEVEL=debug npm test -- integration/program/check.test
 */

import { AbapConnection, createAbapConnection } from '@mcp-abap-adt/connection';
import { checkProgram } from '../../../core/program/check';
import { getProgram } from '../../../core/program/read';
import { createProgram } from '../../../core/program/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig, hasAuthFailed } from '../../helpers/sessionConfig';
import { createTestLogger } from '../../helpers/testLogger';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');
const { getTimeout } = require('../../../../tests/test-helper');

const TEST_SUITE_NAME = 'Program - Check';
const logger = createTestLogger('PROGRAM-CHECK');

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

    const env = await setupTestEnvironment(connection, 'program_check', __filename);
    sessionId = env.sessionId;
    testConfig = env.testConfig;
    lockTracking = env.lockTracking;

    const tc = getEnabledTestCase('check_program', 'test_program');
    if (!tc) {
      logger.skip('Test', 'Test case not enabled in test-config.yaml');
      return;
    }

    try {
      validateTestCaseForUserSpace(tc, 'check_program');
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
    const pName = testCase.params.program_name;

    try {
      await getProgram(connection, pName);
      logger.debug(`Program ${pName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Program ${pName} does not exist, creating...`);
        let createTestCase = getEnabledTestCase('create_program', 'test_program');
        if (!createTestCase) {
          const checkTestCase = getEnabledTestCase('check_program', 'test_program');
          if (checkTestCase) {
            createTestCase = {
              params: {
                program_name: pName,
                package_name: checkTestCase.params.package_name || getDefaultPackage(),
                transport_request: checkTestCase.params.transport_request || getDefaultTransport(),
                description: `Test program for ${pName}`,
                program_type: 'executable'
              }
            };
          }
        }

        if (!createTestCase) {
          throw new Error(`Cannot create program ${pName}: create_program test case not found`);
        }

        await createProgram(connection, {
          program_name: pName,
          description: createTestCase.params.description || `Test program for ${pName}`,
          package_name: createTestCase.params.package_name || getDefaultPackage(),
          transport_request: createTestCase.params.transport_request || getDefaultTransport(),
          program_type: createTestCase.params.program_type || 'executable'
        });
        logger.debug(`Program ${pName} created successfully`);
      } else if (error.response?.status === 401) {
        logger.skip('Test', 'Authentication error');
        throw error;
      } else {
        throw error;
      }
    }
  }

  it('should check program syntax (active version)', async () => {
    if (!testCase || !programName) {
      logger.skip('Check Test', testCase ? 'Program name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for program (active): ${programName}`);

    try {
      await ensureProgramExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkProgram(connection, programName, 'active', checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Program ${programName} syntax check (active) completed`);

    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.skip('Check Test', 'Authentication error');
        return;
      }
      logger.error(`✗ Failed to check program syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));

  it('should check program syntax (inactive version)', async () => {
    if (!testCase || !programName) {
      logger.skip('Check Test', testCase ? 'Program name not set' : 'Test case not configured');
      return;
    }

    logger.info(`Testing syntax check for program (inactive): ${programName}`);

    try {
      await ensureProgramExists(testCase);

      const checkSessionId = generateSessionId();
      const result = await checkProgram(connection, programName, 'inactive', checkSessionId);
      expect(result.status).toBeGreaterThanOrEqual(200);
      expect(result.status).toBeLessThan(500);
      logger.info(`✓ Program ${programName} syntax check (inactive) completed`);

    } catch (error: any) {
      if (error.response?.status === 401) {
        logger.skip('Check Test', 'Authentication error');
        return;
      }
      logger.error(`✗ Failed to check program syntax: ${error.message}`);
      throw error;
    }
  }, getTimeout('test'));
});
