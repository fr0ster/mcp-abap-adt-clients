/**
 * Unit test for View creation
 * Tests createView function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/view/create.test
 */

import { AbapConnection, createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { createView } from '../../../core/view/create';
import { getViewMetadata } from '../../../core/view/read';
import { deleteView } from '../../../core/view/delete';
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

describe('View - Create', () => {
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

  async function ensureViewDoesNotExist(testCase: any): Promise<boolean> {
    if (!connection || !hasConfig) {
      return false;
    }
    try {
      await getViewMetadata(connection, testCase.params.view_name);
      logger.debug(`View ${testCase.params.view_name} exists, attempting to delete...`);
      try {
        await deleteView(connection, { view_name: testCase.params.view_name });
        logger.debug(`View ${testCase.params.view_name} deleted successfully`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return true;
      } catch (deleteError: any) {
        logger.warn(`Failed to delete view ${testCase.params.view_name}: ${deleteError.message}`);
        return false;
      }
    } catch (error: any) {
      if (error.response?.status === 404 || error.response?.status === 401) {
        logger.debug(`View ${testCase.params.view_name} does not exist`);
        return true;
      }
      throw error;
    }
  }

  it('should create basic view', async () => {
    if (!hasConfig || !connection) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('create_view');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    try {
      validateTestCaseForUserSpace(testCase, 'create_view');
    } catch (error: any) {
      logger.warn(`⚠️ Skipping test: ${error.message}`);
      return;
    }

    const canProceed = await ensureViewDoesNotExist(testCase);
    if (!canProceed) {
      logger.warn(`⚠️ Skipping test: Cannot ensure view ${testCase.params.view_name} does not exist`);
      return;
    }

    await createView(connection, {
      view_name: testCase.params.view_name,
      description: testCase.params.description,
      package_name: testCase.params.package_name || getDefaultPackage(),
      transport_request: testCase.params.transport_request || getDefaultTransport(),
      ddl_source: testCase.params.ddl_source
    });

    const result = await getViewMetadata(connection, testCase.params.view_name);
    expect(result.status).toBe(200);
  }, 60000);
});

