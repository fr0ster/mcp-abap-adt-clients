/**
 * Unit test for Program creation
 * Tests createProgram function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/program/create.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { setupTestEnvironment, cleanupTestEnvironment, getConfig } from '../../helpers/sessionConfig';
import { getProgramMetadata, getProgramSource } from '../../../core/program/read';
import { createProgram } from '../../../core/program/create';
import { deleteProgram } from '../../../core/program/delete';
import { validateProgramName } from '../../../core/program/validation';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');


const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Program - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;
  let sessionId: string | null = null;
  let testConfig: any = null;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      const env = await setupTestEnvironment(connection, '${module}_create', __filename);
      sessionId = env.sessionId;
      testConfig = env.testConfig;
      await (connection as any).connect();
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
  });

  async function ensureProgramDoesNotExist(testCase: any): Promise<boolean> {
    if (!connection || !hasConfig) {
      return false;
    }
    try {
      await getProgramMetadata(connection, testCase.params.program_name);
      logger.debug(`Program ${testCase.params.program_name} exists, attempting to delete...`);
      try {
        await deleteProgram(connection, { program_name: testCase.params.program_name });
        logger.debug(`Program ${testCase.params.program_name} deleted successfully`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      } catch (deleteError: any) {
        logger.warn(`Failed to delete program ${testCase.params.program_name}: ${deleteError.message}`);
        return false;
      }
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 401) {
        logger.debug(`Program ${testCase.params.program_name} does not exist`);
        return true;
      }
      throw error;
    }
  }

  it('should create basic program', async () => {
    if (!hasConfig || !connection) {
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

    const canProceed = await ensureProgramDoesNotExist(testCase);
    if (!canProceed) {
      logger.warn(`⚠️ Skipping test: Cannot ensure program ${testCase.params.program_name} does not exist`);
      return;
    }

    await createProgram(connection, {
      program_name: testCase.params.program_name,
      description: testCase.params.description || `Test program for ${testCase.params.program_name}`,
      package_name: testCase.params.package_name || getDefaultPackage(),
      transport_request: testCase.params.transport_request || getDefaultTransport(),
      source_code: testCase.params.source_code
    });

    const result = await getProgramMetadata(connection, testCase.params.program_name);
    expect(result.status).toBe(200);
  }, 60000);
});

