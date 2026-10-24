/**
 * Unit test for getSqlQuery shared function
 * Tests getSqlQuery function using AdtClient/AdtUtils
 *
 * ⚠️ ABAP Cloud Limitation: This function works only for on-premise systems.
 *
 * Enable debug logs: DEBUG_TESTS=true npm test -- unit/shared/sqlQuery.test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SapConfig } from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import { integrationHeadersOf } from '../../helpers/adtHeaders';
import { gate, missingCaseMessage } from '../../helpers/caseGate';
import { expectResult } from '../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { TestConfigResolver } from '../../helpers/TestConfigResolver';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

describe('Shared - getSqlQuery', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let isLegacy = false;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, testsLogger);
      client = resolvedClient;
      isLegacy = legacy;
      // Check if this is a cloud system using system information endpoint
      isCloudSystem = await isCloudEnvironment(connection);
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

  gate('sql_query', 'execute_sql_query')(
    'should execute SQL query',
    async () => {
      // Get test case from YAML configuration
      const resolver = new TestConfigResolver({
        isCloud: isCloudSystem,
        isLegacy,
        logger: testsLogger,
        handlerName: 'sql_query',
        testCaseName: 'execute_sql_query',
      });

      const testCase = resolver.getTestCase();
      if (!testCase)
        throw new Error(missingCaseMessage('sql_query', 'execute_sql_query'));

      // Get SQL query from params or build from standard_objects.tables
      let sqlQuery = resolver.getParam('sql_query');
      if (!sqlQuery) {
        const tableName = resolver.getObjectName('table_name', 'table');
        sqlQuery = `SELECT * FROM ${tableName}`;
      }
      const rowNumber = resolver.getParam('row_number', 10);

      logTestStep('execute SQL query', testsLogger);
      // The contract, not the status: ADT answers a refusal inside a 200, and
      // on a legacy system this endpoint is absent altogether — both come back
      // as the failure half, naming which.
      const document = expectResult(
        await withAcceptHandling(
          client.getUtils().getSqlQuery(
            {
              sql_query: sqlQuery,
              row_number: rowNumber,
            },
            { headers: integrationHeadersOf(client.getUtils(), 'getSqlQuery') },
          ),
        ),
        'SQL query',
      ) as string;
      expect(typeof document).toBe('string');
    },
    30000,
  );

  gate('sql_query', 'execute_sql_query_default_row_number')(
    'should use default row_number if not provided',
    async () => {
      // Get test case from YAML configuration
      const resolver = new TestConfigResolver({
        isCloud: isCloudSystem,
        isLegacy,
        logger: testsLogger,
        handlerName: 'sql_query',
        testCaseName: 'execute_sql_query_default_row_number',
      });

      const testCase = resolver.getTestCase();
      if (!testCase)
        throw new Error(
          missingCaseMessage(
            'sql_query',
            'execute_sql_query_default_row_number',
          ),
        );

      // Get SQL query from params or build from standard_objects.tables
      let sqlQuery = resolver.getParam('sql_query');
      if (!sqlQuery) {
        const tableName = resolver.getObjectName('table_name', 'table');
        sqlQuery = `SELECT * FROM ${tableName}`;
      }

      logTestStep('execute SQL query with default row_number', testsLogger);
      // The contract, not the status: ADT answers a refusal inside a 200, and
      // on a legacy system this endpoint is absent altogether — both come back
      // as the failure half, naming which.
      const document = expectResult(
        await withAcceptHandling(
          client.getUtils().getSqlQuery(
            {
              sql_query: sqlQuery,
            },
            { headers: integrationHeadersOf(client.getUtils(), 'getSqlQuery') },
          ),
        ),
        'SQL query',
      ) as string;
      expect(typeof document).toBe('string');
    },
    30000,
  );

  // Asks the same of the system as the first case of the section.
  gate('sql_query', 'execute_sql_query')(
    'should throw error if SQL query is missing',
    async () => {
      // **An empty query is refused, and the refusal is the server's.**
      //
      // This asserted `rejects.toThrow('SQL query is required')`, which pinned
      // two things that are both gone. Since "the verdict on a response belongs
      // to the consumer" (#142) a refusal is answered rather than thrown — the
      // old expectation failed with `Resolved to value: {"getError": [Function],
      // "ok": false}`, the refusal happening exactly as intended and reported as
      // a failure. And the message was a client-side guard this library no
      // longer invents: the empty query goes to the server, which answers 400.
      //
      // So what is asserted is what is true — it is refused — and not the
      // wording of a check that no longer exists.
      logTestStep('validate error if SQL query is missing', testsLogger);
      const answer = await client
        .getUtils()
        .getSqlQuery(
          { sql_query: '' },
          { headers: integrationHeadersOf(client.getUtils(), 'getSqlQuery') },
        );
      if (answer.ok) throw new Error('expected an empty query to be refused');
      expect(answer.getError().message).toMatch(/\S/);
      testsLogger.info?.(`empty query refused: ${answer.getError().message}`);
    },
  );
});
