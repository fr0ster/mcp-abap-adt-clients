/**
 * Unit test for Structure reading
 * Tests getStructure function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/structure/read.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { getStructureSource, getStructureMetadata } from '../../../core/structure/read';
import { createStructure } from '../../../core/structure/create';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase, getDefaultPackage, getDefaultTransport } = require('../../../../tests/test-helper');

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

describe('Structure - Read', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      hasConfig = true;
    } catch (error) {
      logger.warn('⚠️ Skipping tests: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  async function ensureStructureExists(testCase: any) {
    try {
      await getStructureMetadata(connection, testCase.params.structure_name);
      logger.debug(`Structure ${testCase.params.structure_name} exists`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.debug(`Structure ${testCase.params.structure_name} does not exist, creating...`);
        await createStructure(connection, {
          structure_name: testCase.params.structure_name,
          description: testCase.params.description || `Test structure for ${testCase.params.structure_name}`,
          package_name: testCase.params.package_name || getDefaultPackage(),
          transport_request: testCase.params.transport_request || getDefaultTransport(),
          fields: testCase.params.fields
        });
        logger.debug(`Structure ${testCase.params.structure_name} created successfully`);
      } else {
        throw error;
      }
    }
  }

  it('should read existing structure', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    await ensureStructureExists(testCase);

    const result = await getStructureMetadata(connection, testCase.params.structure_name);
    expect(result.status).toBe(200);
  }, 15000);

  it('should read structure source code', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    await ensureStructureExists(testCase);

    const result = await getStructureSource(connection, testCase.params.structure_name);
    expect(result.status).toBe(200);
    expect(typeof result.data).toBe('string');
  }, 15000);

  it('should read structure metadata', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('get_structure');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    await ensureStructureExists(testCase);

    const result = await getStructureMetadata(connection, testCase.params.structure_name);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 15000);
});

