/**
 * Unit test for Program reading
 * Tests getProgramMetadata and getProgramSource functions
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/program/read.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { getProgramMetadata, getProgramSource } from '../../../core/program/read';
import { createProgram } from '../../../core/program/create';
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
  warn: console.warn,
  error: debugEnabled ? console.error : () => {},
  csrfToken: debugEnabled ? console.log : () => {},
};

describe('Program - Read', () => {
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

  it('should read program metadata', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('read_program');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'read_program');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureProgramExists(testCase);

    const result = await getProgramMetadata(connection, testCase.params.program_name);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);

  it('should read program source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('read_program');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'read_program');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureProgramExists(testCase);

    const result = await getProgramSource(connection, testCase.params.program_name);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');
  }, 30000);
});

