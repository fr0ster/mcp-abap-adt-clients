/**
 * Unit test for Program lock/unlock operations
 * Tests lockProgram and unlockProgram functions
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/program/lock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { lockProgram } from '../../../core/program/lock';
import { unlockProgram } from '../../../core/program/unlock';
import { getProgramMetadata, getProgramSource } from '../../../core/program/read';
import { createProgram } from '../../../core/program/create';
import { activateProgram } from '../../../core/program/activation';
import { updateProgramSource } from '../../../core/program/update';
import { generateSessionId } from '../../../utils/sessionUtils';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Program - Lock/Unlock', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;
  let lockHandle: string | null = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_lock', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    await cleanupTestEnvironment(connection, sessionId, testConfig);
    if (connection) {
      connection.reset();
    }
    lockHandle = null;
  });

  async function ensureProgramExists(testCase: any) {
    const programName = testCase.params.program_name;

    try {
      await getProgramMetadata(connection, programName);
      logger.debug(`Program ${programName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Program ${programName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_program');
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
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_program');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'create_program');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureProgramExists(testCase);

    const sessionId = generateSessionId();

    // Lock program
    lockHandle = await lockProgram(
      connection,
      testCase.params.program_name,
      sessionId
    );
    expect(lockHandle).toBeDefined();
    expect(lockHandle).not.toBe('');

    // Unlock program
    await unlockProgram(
      connection,
      testCase.params.program_name,
      lockHandle,
      sessionId
    );
    lockHandle = null;
  }, 30000);
});

