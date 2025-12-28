/**
 * Unit test for Class run operation
 * Tests runClass function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/run.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { runClass } from '../../../../core/class/run';
import { getConfig } from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const { getEnabledTestCase } = require('../../../helpers/test-helper');
const { getTimeout } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger = createConnectionLogger();
const testsLogger = createTestsLogger();

describe('Class - Run', () => {
  let connection: IAbapConnection;
  let hasConfig = false;

  beforeEach(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
    } catch (_error) {
      testsLogger.warn(
        '⚠️ Skipping tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterEach(async () => {
    if (connection) {
      (connection as any).reset();
    }
  });

  it('should run class and get console output', async () => {
    if (!hasConfig) {
      testsLogger.warn(
        '⚠️ Skipping test: No .env file or SAP configuration found',
      );
      return;
    }

    const testCase = getEnabledTestCase('run_class');
    if (!testCase) {
      testsLogger.warn('⚠️ Skipping test: Test case is disabled');
      return;
    }

    const result = await runClass(connection, testCase.params.class_name);
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
  }, 30000);
});
