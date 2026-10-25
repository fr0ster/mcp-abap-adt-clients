/**
 * Integration test for SystemMessages
 * Tests SM02 system message APIs using AdtRuntimeClient.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Runtime client library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- src/__tests__/integration/runtime/logs/SystemMessages.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
import {
  configuredCase,
  gate,
  missingCaseMessage,
} from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import {
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getTimeout,
  isHttpStatusAllowed,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

describe('SystemMessages (using AdtRuntimeClient)', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let runtime: AdtRuntimeClient;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
      runtime = new AdtRuntimeClient(connection, libraryLogger);
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

  gate('runtime_system_messages', 'adt_system_messages')(
    'should list system messages',
    async () => {
      const testName = 'SystemMessages - list';
      const testCase = configuredCase(
        'runtime_system_messages',
        'adt_system_messages',
      );

      logTestStart(testsLogger, testName, {
        name: 'adt_system_messages',
        params: testCase?.params || {},
      });

      if (!testCase) {
        throw new Error(
          missingCaseMessage('runtime_system_messages', 'adt_system_messages'),
        );
      }

      try {
        logTestStep('list system messages', testsLogger);
        const response = expectResult(
          await runtime.getSystemMessages().list({ analyse: analyseException }),
          'response',
        );
        expect(response).toBeDefined();

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  gate('runtime_system_messages', 'adt_system_messages')(
    'should list system messages with maxResults filter',
    async () => {
      const testName = 'SystemMessages - list with maxResults';
      const testCase = configuredCase(
        'runtime_system_messages',
        'adt_system_messages',
      );

      logTestStart(testsLogger, testName, {
        name: 'adt_system_messages',
        params: testCase?.params || {},
      });

      if (!testCase) {
        throw new Error(
          missingCaseMessage('runtime_system_messages', 'adt_system_messages'),
        );
      }

      try {
        logTestStep('list system messages with maxResults: 5', testsLogger);
        const response = expectResult(
          await runtime
            .getSystemMessages()
            .list({ analyse: analyseException, maxResults: 5 }),
          'response',
        );
        expect(response).toBeDefined();

        logTestSuccess(testsLogger, testName);
      } catch (error) {
        if ((error as any)?.response?.status === 406) {
          if (isHttpStatusAllowed(406, testCase)) {
            logTestSkip(
              testsLogger,
              testName,
              'HTTP 406 Not Acceptable is allowed for this test case',
            );
            return;
          }
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );
});
