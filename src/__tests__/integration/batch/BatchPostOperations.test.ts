/**
 * Exploratory test: Can the batch endpoint handle POST (write) operations?
 *
 * Sends POST requests via /sap/bc/adt/debugger/batch to verify that the
 * batch endpoint is not limited to GET (read-only) requests.
 *
 * Test cases:
 *   1. Single POST: validate class name (safe, no side effects)
 *   2. Multiple POSTs: validate + check in one batch
 *   3. POST with XML body: check run with object reference
 *
 * Run:
 *   DEBUG_ADT_TESTS=true npm test -- src/__tests__/integration/batch/BatchPostOperations.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { buildBatchPayload } from '../../../batch/buildBatchPayload';
import type { IBatchRequestPart } from '../../../batch/types';
import { parseBatchResponse } from '../../../batch/parseBatchResponse';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { createTestAdtClient, getConfig } from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestStep,
  logTestSuccess,
} from '../../helpers/testProgressLogger';

const { getTimeout } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const testsLogger: ILogger = createTestsLogger();

describe('Batch POST operations', () => {
  let connection: IAbapConnection | null = null;
  let hasConfig = false;
  let isCloud = false;
  let isLegacy = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      if (!config) {
        testsLogger.warn?.(
          'Skipping tests: No .env file or SAP configuration found',
        );
        return;
      }

      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      hasConfig = true;
      isCloud = await isCloudEnvironment(connection);
      const { isLegacy: legacy } = await createTestAdtClient(
        connection,
        connectionLogger,
      );
      isLegacy = legacy;

      testsLogger.info?.(
        `Batch POST test environment setup complete (${isCloud ? 'cloud' : isLegacy ? 'legacy' : 'onprem'})`,
      );
    } catch (error: any) {
      testsLogger.error?.('Failed to setup test environment:', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (connection) {
      testsLogger.info?.('Batch POST test environment cleanup complete');
    }
  });

  async function executeBatch(
    parts: IBatchRequestPart[],
  ): Promise<{ status: number; statusText: string; data: string }[]> {
    if (!connection) throw new Error('No connection');

    const payload = buildBatchPayload(parts);

    if (process.env.DEBUG_ADT_TESTS === 'true') {
      logTestStep(`batch payload:\n${payload.body}`, testsLogger);
    }

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

    const contentType = String(response.headers?.['content-type'] ?? '');
    const parsed = parseBatchResponse(String(response.data), contentType);

    if (process.env.DEBUG_ADT_TESTS === 'true') {
      for (let i = 0; i < parsed.length; i++) {
        logTestStep(
          `part ${i + 1}: ${parsed[i].status} ${parsed[i].statusText} (${parsed[i].data.length} bytes)`,
          testsLogger,
        );
        logTestStep(
          `part ${i + 1} body (first 500 chars): ${parsed[i].data.substring(0, 500)}`,
          testsLogger,
        );
      }
    }

    return parsed;
  }

  describe('single POST — validate class name', () => {
    it(
      'should accept a POST validate request in batch',
      async () => {
        const testName = 'Batch POST - validate class name';
        if (!hasConfig || !connection) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }

        logTestStart(testsLogger, testName, {
          name: 'batch_post_validate',
          params: {},
        });

        try {
          const parts: IBatchRequestPart[] = [
            {
              method: 'POST',
              url: '/sap/bc/adt/oo/validation/objectname',
              headers: {
                Accept: 'application/vnd.sap.adt.oo.Validation+xml',
              },
              params: {
                objname: 'CL_ABAP_TYPEDESCR',
                objtype: 'CLAS/OC',
              },
            },
          ];

          const results = await executeBatch(parts);

          logTestStep(`parts returned: ${results.length}`, testsLogger);
          expect(results.length).toBe(1);

          logTestStep(
            `validate status: ${results[0].status} ${results[0].statusText}`,
            testsLogger,
          );
          // 200 = valid, 409 = conflict (already exists) — both confirm POST works
          expect(results[0].status).toBeLessThan(500);

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });

  describe('mixed GET + POST in one batch', () => {
    it(
      'should handle GET readMetadata + POST validate in a single batch',
      async () => {
        const testName = 'Batch mixed - GET read + POST validate';
        if (!hasConfig || !connection) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }

        logTestStart(testsLogger, testName, {
          name: 'batch_mixed_get_post',
          params: {},
        });

        try {
          const parts: IBatchRequestPart[] = [
            // Part 1: GET — read class metadata
            {
              method: 'GET',
              url: '/sap/bc/adt/oo/classes/cl_abap_typedescr',
              headers: {
                Accept: 'application/vnd.sap.adt.oo.classes.v4+xml',
              },
            },
            // Part 2: POST — validate class name
            {
              method: 'POST',
              url: '/sap/bc/adt/oo/validation/objectname',
              headers: {
                Accept: 'application/vnd.sap.adt.oo.Validation+xml',
              },
              params: {
                objname: 'ZAC_BATCH_TEST_NONEXIST',
                objtype: 'CLAS/OC',
              },
            },
          ];

          const results = await executeBatch(parts);

          logTestStep(`parts returned: ${results.length}`, testsLogger);
          expect(results.length).toBe(2);

          logTestStep(
            `GET read status: ${results[0].status} ${results[0].statusText}`,
            testsLogger,
          );
          logTestStep(
            `POST validate status: ${results[1].status} ${results[1].statusText}`,
            testsLogger,
          );

          // GET read should succeed
          expect(results[0].status).toBe(200);
          expect(results[0].data).toContain('cl_abap_typedescr');

          // POST validate should succeed (200 = name is valid/available)
          expect(results[1].status).toBeLessThan(500);

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });

  describe('POST with XML body — check run', () => {
    it(
      'should accept a POST check run with XML body in batch',
      async () => {
        const testName = 'Batch POST - check run with XML body';
        if (!hasConfig || !connection) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }

        logTestStart(testsLogger, testName, {
          name: 'batch_post_check_body',
          params: {},
        });

        try {
          const checkXml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">',
            '  <chkrun:checkObject adtcore:uri="/sap/bc/adt/oo/classes/cl_abap_typedescr" chkrun:version="active"/>',
            '</chkrun:checkObjectList>',
          ].join('\n');

          const parts: IBatchRequestPart[] = [
            {
              method: 'POST',
              url: '/sap/bc/adt/checkruns',
              headers: {
                Accept: 'application/vnd.sap.adt.oo.CheckMessages+xml',
                'Content-Type':
                  'application/vnd.sap.adt.oo.CheckObjects+xml',
              },
              params: {
                reporters: 'abapCheckRun',
              },
              data: checkXml,
            },
          ];

          const results = await executeBatch(parts);

          logTestStep(`parts returned: ${results.length}`, testsLogger);
          expect(results.length).toBe(1);

          logTestStep(
            `check run status: ${results[0].status} ${results[0].statusText}`,
            testsLogger,
          );
          // 200 = check completed successfully
          expect(results[0].status).toBeLessThan(500);

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });

  describe('multiple POSTs — validate + check in one batch', () => {
    it(
      'should execute two POST operations in a single batch',
      async () => {
        const testName = 'Batch POST - validate + check combined';
        if (!hasConfig || !connection) {
          logTestSkip(testsLogger, testName, 'No SAP configuration');
          return;
        }

        logTestStart(testsLogger, testName, {
          name: 'batch_post_validate_check',
          params: {},
        });

        try {
          const checkXml = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">',
            '  <chkrun:checkObject adtcore:uri="/sap/bc/adt/oo/classes/cl_abap_typedescr" chkrun:version="active"/>',
            '</chkrun:checkObjectList>',
          ].join('\n');

          const parts: IBatchRequestPart[] = [
            // Part 1: POST validate
            {
              method: 'POST',
              url: '/sap/bc/adt/oo/validation/objectname',
              headers: {
                Accept: 'application/vnd.sap.adt.oo.Validation+xml',
              },
              params: {
                objname: 'ZAC_BATCH_TEST_NONEXIST',
                objtype: 'CLAS/OC',
              },
            },
            // Part 2: POST check run
            {
              method: 'POST',
              url: '/sap/bc/adt/checkruns',
              headers: {
                Accept: 'application/vnd.sap.adt.oo.CheckMessages+xml',
                'Content-Type':
                  'application/vnd.sap.adt.oo.CheckObjects+xml',
              },
              params: {
                reporters: 'abapCheckRun',
              },
              data: checkXml,
            },
          ];

          const results = await executeBatch(parts);

          logTestStep(`parts returned: ${results.length}`, testsLogger);
          expect(results.length).toBe(2);

          logTestStep(
            `validate status: ${results[0].status} ${results[0].statusText}`,
            testsLogger,
          );
          logTestStep(
            `check run status: ${results[1].status} ${results[1].statusText}`,
            testsLogger,
          );

          expect(results[0].status).toBeLessThan(500);
          expect(results[1].status).toBeLessThan(500);

          logTestSuccess(testsLogger, testName);
        } catch (error) {
          logTestError(testsLogger, testName, error);
          throw error;
        } finally {
          logTestEnd(testsLogger, testName);
        }
      },
      getTimeout('test'),
    );
  });
});
