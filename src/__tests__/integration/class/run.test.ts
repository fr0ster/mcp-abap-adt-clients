/**
 * Unit test for Class run operation
 * Tests runClass function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/run.test
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { createAbapConnection, SapConfig } from '@mcp-abap-adt/connection';
import { runClass } from '../../../core/class/run';
import { getConfig } from '../../helpers/sessionConfig';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const { getEnabledTestCase } = require('../../helpers/test-helper');
const { getTimeout } = require('../../helpers/test-helper');

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

describe('Class - Run', () => {
  let connection: IAbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
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

  afterEach(async () => {
    if (connection) {
      connection.reset();
    }
  });

  it('should run class and get console output', async () => {
    if (!hasConfig) {
      logger.warn('⚠️ Skipping test: No .env file or SAP configuration found');
      return;
    }

    const testCase = getEnabledTestCase('run_class');
    if (!testCase) {
      logger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    const result = await runClass(connection, testCase.params.class_name);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);
});
