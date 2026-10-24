/**
 * Unit test for Class run operation
 * Tests runClass function
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/class/run.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import * as dotenv from 'dotenv';
import { runClass } from '../../../../core/class/run';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import {
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const { getTimeout } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger = createConnectionLogger();
const testsLogger = createTestsLogger();

describe('Class - Run', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  gate('run_class', 'run_class')(
    'should run class and get console output',
    async () => {
      const testCase = configuredCase('run_class', 'run_class');
      if (!testCase)
        throw new Error(missingCaseMessage('run_class', 'run_class'));

      const result = await runClass(connection, testCase.params.class_name);
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
    },
    30000,
  );
});
