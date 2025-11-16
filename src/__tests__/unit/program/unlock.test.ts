/**
 * Unit test for Program unlock operations
 * Tests unlockProgram function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/program/unlock.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { unlockProgram } from '../../../core/program/unlock';
import { lockProgram } from '../../../core/program/lock';
import { getProgramMetadata } from '../../../core/program/read';
import { createProgram } from '../../../core/program/create';
import { generateSessionId } from '../../../utils/sessionUtils';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, validateTestCaseForUserSpace, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const debugEnabled = process.env.DEBUG_TESTS === 'true';
const logger = {
  debug: debugEnabled ? console.log : () => {},
  info: debugEnabled ? console.log : () => {},
  warn: debugEnabled ? console.warn : () => {},
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Program - Unlock', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      connection.reset();
    }
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
        if (createTestCase) {
          try {
            await createProgram(connection, {
              program_name: programName,
              description: createTestCase.params.description || `Test program for ${programName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              source_code: createTestCase.params.source_code
            });
            logger.debug(`Program ${programName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create program ${programName}: create_program test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should unlock program', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('unlock_program');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'unlock_program');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureProgramExists(testCase);

    const sessionId = generateSessionId();

    // Lock program first
    const lockHandle = await lockProgram(
      connection,
      testCase.params.program_name,
      sessionId
    );

    // Unlock program
    const result = await unlockProgram(
      connection,
      testCase.params.program_name,
      lockHandle,
      sessionId
    );
    expect(result.status).toBeGreaterThanOrEqual(200);
    expect(result.status).toBeLessThan(500);
  }, 30000);
});

