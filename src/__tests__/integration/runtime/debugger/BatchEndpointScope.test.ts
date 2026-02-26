/**
 * Exploratory test: Can the debugger batch endpoint handle non-debugger ADT requests?
 *
 * Sends a multipart/mixed batch to /sap/bc/adt/debugger/batch containing:
 *   1. A non-debugger request (GET /sap/bc/adt/discovery)
 *   2. A non-debugger request (GET /sap/bc/adt/oo/classes/{className}/source/main)
 *
 * Purpose: Determine if the batch endpoint is a generic ADT request router
 * or if it only accepts debugger-scoped inner requests.
 *
 * Run:
 *   DEBUG_ADT_TESTS=true npm test -- src/__tests__/integration/runtime/debugger/BatchEndpointScope.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  buildDebuggerBatchPayload,
  type IDebuggerBatchPayload,
} from '../../../../runtime/debugger/abap';
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

const { getTimeout } = require('../../../helpers/test-helper');

/**
 * Build batch payload preserving empty line after headers.
 * Unlike buildDebuggerBatchPayload which trims inner requests,
 * this ensures each inner request ends with \r\n (empty line after headers).
 */
function buildBatchPayloadWithEmptyLine(
  requests: string[],
): IDebuggerBatchPayload {
  const boundary = `batch_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  const parts = requests
    .map((request) => {
      return [
        `--${boundary}`,
        'Content-Type: application/http',
        'content-transfer-encoding: binary',
        '',
        request,
      ].join('\r\n');
    })
    .join('');

  return {
    boundary,
    body: `${parts}\r\n--${boundary}--\r\n`,
  };
}

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const testsLogger: ILogger = createTestsLogger();

describe('Debugger Batch Endpoint Scope', () => {
  let connection: IAbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
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
    'should test if debugger batch accepts non-debugger requests (discovery)',
    async () => {
      const testName = 'Batch scope - discovery via debugger batch';
      logTestStart(testsLogger, testName, {
        name: 'batch_scope_discovery',
        params: {},
      });

      if (!hasConfig || !connection) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

      try {
        // Build batch with a non-debugger request: GET /sap/bc/adt/discovery
        // Each inner HTTP request must end with \r\n\r\n (empty line after headers)
        const discoveryRequest = [
          'GET /sap/bc/adt/discovery HTTP/1.1',
          'Accept:application/atomsvc+xml',
          '',
          '',
        ].join('\r\n');

        const payload = buildBatchPayloadWithEmptyLine([discoveryRequest]);

        logTestStep(
          `raw payload:\n${JSON.stringify(payload.body)}`,
          testsLogger,
        );
        logTestStep(
          'sending non-debugger request (GET /sap/bc/adt/discovery) via /sap/bc/adt/debugger/batch',
          testsLogger,
        );

        const response = await connection.makeAdtRequest({
          url: '/sap/bc/adt/debugger/batch',
          method: 'POST',
          timeout: 30000,
          data: payload.body,
          headers: {
            'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
            Accept: 'multipart/mixed',
          },
        });

        logTestStep(`response status: ${response.status}`, testsLogger);
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

        // Check if the response contains discovery XML or an error
        const hasDiscoveryContent =
          typeof response.data === 'string' &&
          (response.data.includes('atomsvc') ||
            response.data.includes('app:service') ||
            response.data.includes('collection'));

        const hasError =
          typeof response.data === 'string' &&
          (response.data.includes('HTTP/1.1 4') ||
            response.data.includes('HTTP/1.1 5'));

        logTestStep(
          `discovery content found: ${hasDiscoveryContent}`,
          testsLogger,
        );
        logTestStep(`error in inner response: ${hasError}`, testsLogger);

        logTestSuccess(testsLogger, testName);
      } catch (error: any) {
        logTestStep(`request failed with: ${error.message}`, testsLogger);
        if (error.response) {
          logTestStep(`error status: ${error.response.status}`, testsLogger);
          const errorData =
            typeof error.response.data === 'string'
              ? error.response.data.substring(0, 2000)
              : JSON.stringify(error.response.data).substring(0, 2000);
          logTestStep(`error body:\n${errorData}`, testsLogger);
        }
        logTestError(testsLogger, testName, error);
        // Don't throw - this is an exploratory test, we want to see the result
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );

  it(
    'should test if debugger batch accepts mixed debugger + non-debugger requests',
    async () => {
      const testName = 'Batch scope - mixed requests';
      logTestStart(testsLogger, testName, {
        name: 'batch_scope_mixed',
        params: {},
      });

      if (!hasConfig || !connection) {
        logTestSkip(testsLogger, testName, 'No SAP configuration');
        return;
      }

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

        const payload = buildBatchPayloadWithEmptyLine([
          classReadRequest,
          programReadRequest,
        ]);

        logTestStep(
          `raw payload:\n${JSON.stringify(payload.body)}`,
          testsLogger,
        );
        logTestStep(
          'sending 2 non-debugger requests (class + program read) via /sap/bc/adt/debugger/batch',
          testsLogger,
        );

        const response = await connection.makeAdtRequest({
          url: '/sap/bc/adt/debugger/batch',
          method: 'POST',
          timeout: 30000,
          data: payload.body,
          headers: {
            'Content-Type': `multipart/mixed; boundary=${payload.boundary}`,
            Accept: 'multipart/mixed',
          },
        });

        logTestStep(`response status: ${response.status}`, testsLogger);
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

        // Parse multipart response by boundary
        if (typeof response.data === 'string') {
          const contentType = String(response.headers?.['content-type'] ?? '');
          const boundaryMatch = contentType.match(/boundary=([^;]+)/);
          const respBoundary = boundaryMatch?.[1]?.trim();

          console.log(`[BATCH-SCOPE] response boundary: ${respBoundary}`);

          if (respBoundary) {
            const parts = response.data
              .split(`--${respBoundary}`)
              .filter((p: string) => p.trim() && !p.trim().startsWith('--'));
            logTestStep(`multipart parts count: ${parts.length}`, testsLogger);

            for (let i = 0; i < parts.length; i++) {
              const part = parts[i];
              const statusMatch = part.match(/HTTP\/1\.1\s+(\d+)\s+([^\r\n]*)/);
              const status = statusMatch
                ? `${statusMatch[1]} ${statusMatch[2]}`
                : 'unknown';
              console.log(`[BATCH-SCOPE] part ${i + 1} status: ${status}`);
              console.log(
                `[BATCH-SCOPE] part ${i + 1} preview (500 chars): ${part.substring(0, 500)}`,
              );
            }

            console.log(`[BATCH-SCOPE] total parts: ${parts.length}`);
            expect(parts.length).toBe(2);
          }

          const hasClassContent =
            response.data.includes('cl_abap_typedescr') ||
            response.data.includes('CL_ABAP_TYPEDESCR');
          const hasProgramContent =
            response.data.includes('sapmhttp') ||
            response.data.includes('SAPMHTTP');
          console.log(
            `[BATCH-SCOPE] class content found: ${hasClassContent}, program content found: ${hasProgramContent}`,
          );
        }

        logTestSuccess(testsLogger, testName);
      } catch (error: any) {
        logTestStep(`request failed with: ${error.message}`, testsLogger);
        if (error.response) {
          logTestStep(`error status: ${error.response.status}`, testsLogger);
          const errorData =
            typeof error.response.data === 'string'
              ? error.response.data.substring(0, 2000)
              : JSON.stringify(error.response.data).substring(0, 2000);
          logTestStep(`error body:\n${errorData}`, testsLogger);
        }
        logTestError(testsLogger, testName, error);
      } finally {
        logTestEnd(testsLogger, testName);
      }
    },
    getTimeout('test'),
  );
});
