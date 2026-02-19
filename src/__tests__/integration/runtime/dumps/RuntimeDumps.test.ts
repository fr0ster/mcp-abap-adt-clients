/**
 * Integration test for Runtime Dumps
 * Tests runtime dump read APIs using AdtRuntimeClient.
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Runtime client library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- src/__tests__/integration/runtime/dumps/RuntimeDumps.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtRuntimeClient } from '../../../../clients/AdtRuntimeClient';
import { getConfig } from '../../../helpers/sessionConfig';
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
  getEnabledTestCase,
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

function toPositiveInt(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return Math.trunc(num);
}

function extractDumpId(payload: unknown): string | undefined {
  const text =
    typeof payload === 'string'
      ? payload
      : payload == null
        ? ''
        : JSON.stringify(payload);
  const match = text.match(/\/sap\/bc\/adt\/runtime\/dumps\/([A-Za-z0-9]{8,})/);
  return match?.[1];
}

describe('Runtime Dumps (using AdtRuntimeClient)', () => {
  let connection: IAbapConnection;
  let runtime: AdtRuntimeClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      runtime = new AdtRuntimeClient(connection, libraryLogger);
      hasConfig = true;
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      await (connection as any).reset();
    }
  });

  it(
    'should read dumps feed and optionally dump payload by ID',
    async () => {
      const testName = 'Runtime Dumps - read';
      const testCase = getEnabledTestCase('runtime_dumps', 'adt_runtime_dumps');

      logTestStart(testsLogger, testName, {
        name: 'adt_runtime_dumps',
        params: testCase?.params || {},
      });

      if (!testCase) {
        logTestSkip(
          testsLogger,
          testName,
          'runtime_dumps/adt_runtime_dumps not configured or disabled in test-config.yaml',
        );
        return;
      }

      if (!hasConfig || !runtime) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      try {
        const params = testCase?.params || {};
        const top = toPositiveInt(params.top, 20);
        const user =
          typeof params.user === 'string' && params.user.trim()
            ? params.user.trim()
            : undefined;
        const inlinecount =
          params.inlinecount === 'allpages' ? 'allpages' : undefined;

        logTestStep('list runtime dumps', testsLogger);
        const listResponse = await runtime.listRuntimeDumps({
          top,
          inlinecount,
        });
        expect(listResponse.status).toBeGreaterThanOrEqual(200);
        expect(listResponse.status).toBeLessThan(300);
        expect(listResponse.data).toBeDefined();

        logTestStep('list runtime dumps by user', testsLogger);
        const byUserResponse = await runtime.listRuntimeDumpsByUser(user, {
          top,
          inlinecount,
        });
        expect(byUserResponse.status).toBeGreaterThanOrEqual(200);
        expect(byUserResponse.status).toBeLessThan(300);

        const configuredDumpId =
          typeof params.dump_id === 'string' && params.dump_id.trim()
            ? params.dump_id.trim()
            : undefined;
        const discoveredDumpId = extractDumpId(listResponse.data);
        const dumpId = configuredDumpId || discoveredDumpId;

        if (dumpId) {
          logTestStep(`read runtime dump by id: ${dumpId}`, testsLogger);
          const dumpResponse = await runtime.getRuntimeDumpById(dumpId);
          expect(dumpResponse.status).toBeGreaterThanOrEqual(200);
          expect(dumpResponse.status).toBeLessThan(300);
          expect(dumpResponse.data).toBeDefined();
        } else {
          logTestStep(
            'read runtime dump by id: skipped (no dump id)',
            testsLogger,
          );
        }

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
