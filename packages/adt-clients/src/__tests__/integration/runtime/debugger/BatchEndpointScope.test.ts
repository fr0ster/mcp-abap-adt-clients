/**
 * The debugger batch endpoint routes non-debugger ADT requests (measured on
 * premise and on the cloud, 2026-10-09); this asserts it, part by part.
 *
 * Sends a multipart/mixed batch to /sap/bc/adt/debugger/batch containing:
 *   1. A non-debugger request (GET /sap/bc/adt/discovery)
 *   2. A non-debugger request (GET /sap/bc/adt/oo/classes/{className}/source/main)
 *
 * A refused batch, a refused inner request or a part without its object fails.
 *
 * Run:
 *   DEBUG_ADT_TESTS=true npm test -- src/__tests__/integration/runtime/debugger/BatchEndpointScope.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import { parseBatchResponse } from '../../../../batch/wire';
import {
  buildDebuggerBatchPayload,
  executeBatchRequest,
} from '../../../../runtime/debugger/abap';
import { gateOn } from '../../../helpers/caseGate';
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
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const { getTimeout } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const testsLogger: ILogger = createTestsLogger();

describe('Debugger Batch Endpoint Scope', () => {
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

  gateOn(() => true)(
    'should test if debugger batch accepts non-debugger requests (discovery)',
    async () => {
      const testName = 'Batch scope - discovery via debugger batch';
      logTestStart(testsLogger, testName, {
        name: 'batch_scope_discovery',
        params: {},
      });

      try {
        // Build batch with a non-debugger request: GET /sap/bc/adt/discovery
        // Each inner HTTP request must end with \r\n\r\n (empty line after headers)
        const discoveryRequest = [
          'GET /sap/bc/adt/discovery HTTP/1.1',
          'Accept:application/atomsvc+xml',
          '',
          '',
        ].join('\r\n');

        const payload = buildDebuggerBatchPayload([discoveryRequest]);

        if (process.env.DEBUG_ADT_TESTS === 'true') {
          logTestStep(
            `raw payload:\n${JSON.stringify(payload.body)}`,
            testsLogger,
          );
        }
        logTestStep(
          'sending non-debugger request (GET /sap/bc/adt/discovery) via /sap/bc/adt/debugger/batch',
          testsLogger,
        );

        // The shipped atoms, so this run measures what the package sends.
        const response = await executeBatchRequest(connection, payload);

        logTestStep(`response status: ${response.status}`, testsLogger);

        if (process.env.DEBUG_ADT_TESTS === 'true') {
          logTestStep(
            `response content-type: ${response.headers?.['content-type'] ?? 'N/A'}`,
            testsLogger,
          );

          const dataPreview =
            typeof response.data === 'string'
              ? response.data.substring(0, 2000)
              : JSON.stringify(response.data).substring(0, 2000);
          logTestStep(
            `response body (first 2000 chars):\n${dataPreview}`,
            testsLogger,
          );
        }

        // Measured on premise and on the cloud (2026-10-09): the batch
        // endpoint routes inner requests outside the debugger too. So the
        // batch must answer, its one part must be a 200, and that part must be
        // the discovery document — a refusal anywhere fails the test.
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        const parts = parseBatchResponse(response);
        expect(parts).toHaveLength(1);
        const [discovery] = parts;
        logTestStep(`inner response status: ${discovery.status}`, testsLogger);
        expect(discovery.status).toBe(200);
        const discoveryDocument = String(discovery.data ?? '');
        expect(
          discoveryDocument.includes('app:service') ||
            discoveryDocument.includes('atomsvc'),
        ).toBe(true);

        logTestSuccess(testsLogger, testName);
      } catch (error: any) {
        logTestStep(`request failed with: ${error.message}`, testsLogger);
        if (process.env.DEBUG_ADT_TESTS === 'true' && error.response) {
          logTestStep(`error status: ${error.response.status}`, testsLogger);
          const errorData =
            typeof error.response.data === 'string'
              ? error.response.data.substring(0, 2000)
              : JSON.stringify(error.response.data).substring(0, 2000);
          logTestStep(`error body:\n${errorData}`, testsLogger);
        }
        logTestError(testsLogger, testName, error);
        throw error;
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  gateOn(() => true)(
    'should test if debugger batch accepts mixed debugger + non-debugger requests',
    async () => {
      const testName = 'Batch scope - mixed requests';
      logTestStart(testsLogger, testName, {
        name: 'batch_scope_mixed',
        params: {},
      });

      try {
        // Inner request 1: non-debugger (class metadata read)
        // Each inner HTTP request must end with \r\n\r\n (empty line after headers)
        const classReadRequest = [
          'GET /sap/bc/adt/oo/classes/cl_abap_typedescr HTTP/1.1',
          'Accept:application/vnd.sap.adt.oo.classes.v4+xml',
          '',
          '',
        ].join('\r\n');

        // Inner request 2: non-debugger (program metadata read)
        const programReadRequest = [
          'GET /sap/bc/adt/programs/programs/sapmhttp HTTP/1.1',
          'Accept:application/vnd.sap.adt.programs.programs.v2+xml',
          '',
          '',
        ].join('\r\n');

        const payload = buildDebuggerBatchPayload([
          classReadRequest,
          programReadRequest,
        ]);

        if (process.env.DEBUG_ADT_TESTS === 'true') {
          logTestStep(
            `raw payload:\n${JSON.stringify(payload.body)}`,
            testsLogger,
          );
        }
        logTestStep(
          'sending 2 non-debugger requests (class + program read) via /sap/bc/adt/debugger/batch',
          testsLogger,
        );

        // The shipped atoms, so this run measures what the package sends.
        const response = await executeBatchRequest(connection, payload);

        logTestStep(`response status: ${response.status}`, testsLogger);

        if (process.env.DEBUG_ADT_TESTS === 'true') {
          logTestStep(
            `response content-type: ${response.headers?.['content-type'] ?? 'N/A'}`,
            testsLogger,
          );

          const dataPreview =
            typeof response.data === 'string'
              ? response.data.substring(0, 3000)
              : JSON.stringify(response.data).substring(0, 3000);
          logTestStep(
            `response body (first 3000 chars):\n${dataPreview}`,
            testsLogger,
          );
        }

        // Both inner requests must be answered 200 with their own object:
        // a refused part, a missing part or an unrelated body fails the test.
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(300);
        const parts = parseBatchResponse(response);
        logTestStep(`multipart parts count: ${parts.length}`, testsLogger);
        if (process.env.DEBUG_ADT_TESTS === 'true') {
          for (const [index, part] of parts.entries()) {
            testsLogger.info(
              `[BATCH-SCOPE] part ${index + 1} status: ${part.status} ${part.statusText}`,
            );
          }
        }
        expect(parts).toHaveLength(2);
        const [classPart, programPart] = parts;
        expect(classPart.status).toBe(200);
        expect(programPart.status).toBe(200);
        expect(String(classPart.data ?? '').toUpperCase()).toContain(
          'CL_ABAP_TYPEDESCR',
        );
        expect(String(programPart.data ?? '').toUpperCase()).toContain(
          'SAPMHTTP',
        );

        logTestSuccess(testsLogger, testName);
      } catch (error: any) {
        logTestStep(`request failed with: ${error.message}`, testsLogger);
        if (process.env.DEBUG_ADT_TESTS === 'true' && error.response) {
          logTestStep(`error status: ${error.response.status}`, testsLogger);
          const errorData =
            typeof error.response.data === 'string'
              ? error.response.data.substring(0, 2000)
              : JSON.stringify(error.response.data).substring(0, 2000);
          logTestStep(`error body:\n${errorData}`, testsLogger);
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
