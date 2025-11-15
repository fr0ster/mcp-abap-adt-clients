/**
 * Unit test for Interface creation
 * Tests createInterface function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/interface/create.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createInterface } from '../../../core/interface/create';
import { getInterfaceMetadata } from '../../../core/interface/read';
import { deleteInterface } from '../../../core/interface/delete';
import { validateInterfaceName } from '../../../core/interface/validation';
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

describe('Interface - Create', () => {
  let connection: AbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, logger);
      await (connection as any).connect();
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

  async function ensureInterfaceDoesNotExist(testCase: any): Promise<boolean> {
    if (!connection || !hasConfig) {
      return false;
    }
    try {
      await getInterfaceMetadata(connection, testCase.params.interface_name);
      logger.debug(`Interface ${testCase.params.interface_name} exists, attempting to delete...`);
      try {
        await deleteInterface(connection, { interface_name: testCase.params.interface_name });
        logger.debug(`Interface ${testCase.params.interface_name} deleted successfully`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      } catch (deleteError: any) {
        logger.warn(`Failed to delete interface ${testCase.params.interface_name}: ${deleteError.message}`);
        return false;
      }
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 401) {
        logger.debug(`Interface ${testCase.params.interface_name} does not exist`);
        return true;
      }
      throw error;
    }
  }

  it('should create basic interface', async () => {
    if (!hasConfig || !connection) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_interface');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'create_interface');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    const canProceed = await ensureInterfaceDoesNotExist(testCase);
    if (!canProceed) {
      logger.warn(`⚠️ Skipping test: Cannot ensure interface ${testCase.params.interface_name} does not exist`);
      return;
    }

    await createInterface(connection, {
      interface_name: testCase.params.interface_name,
      description: testCase.params.description || `Test interface for ${testCase.params.interface_name}`,
      package_name: testCase.params.package_name || getDefaultPackage(),
      transport_request: testCase.params.transport_request || getDefaultTransport(),
      source_code: testCase.params.source_code
    });

    const result = await getInterfaceMetadata(connection, testCase.params.interface_name);
    expect(result.status).toBe(200);
  }, 60000);
});

