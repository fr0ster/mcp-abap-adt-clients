/**
 * Unit test for Interface reading
 * Tests getInterfaceMetadata and getInterfaceSource functions
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/interface/read.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { getInterfaceMetadata, getInterfaceSource } from '../../../core/interface/read';
import { createInterface } from '../../../core/interface/create';
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

describe('Interface - Read', () => {
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

  async function ensureInterfaceExists(testCase: any) {
    const interfaceName = testCase.params.interface_name;

    try {
      await getInterfaceMetadata(connection, interfaceName);
      logger.debug(`Interface ${interfaceName} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Interface ${interfaceName} does not exist, creating...`);
        const createTestCase = getEnabledTestCase('create_interface');
        if (createTestCase) {
          try {
            await createInterface(connection, {
              interface_name: interfaceName,
              description: createTestCase.params.description || `Test interface for ${interfaceName}`,
              package_name: createTestCase.params.package_name || getDefaultPackage(),
              transport_request: createTestCase.params.transport_request || getDefaultTransport(),
              source_code: createTestCase.params.source_code
            });
            logger.debug(`Interface ${interfaceName} created successfully`);
          } catch (createError: any) {
            throw createError;
          }
        } else {
          throw new Error(`Cannot create interface ${interfaceName}: create_interface test case not found`);
        }
      } else {
        throw error;
      }
    }
  }

  it('should read interface metadata', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('read_interface');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'read_interface');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureInterfaceExists(testCase);

    const result = await getInterfaceMetadata(connection, testCase.params.interface_name);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);

  it('should read interface source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('read_interface');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'read_interface');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    await ensureInterfaceExists(testCase);

    const result = await getInterfaceSource(connection, testCase.params.interface_name);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');
  }, 30000);
});

