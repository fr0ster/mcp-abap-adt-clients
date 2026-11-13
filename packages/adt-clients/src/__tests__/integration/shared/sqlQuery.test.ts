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
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { SapConfig } from '@mcp-abap-adt/connection';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { wrapSqlLines } from '../../../core/shared/sqlLines';
import { utilDocuments } from '../../../core/shared/utilResultSet';
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
import { recordRequests } from '../../helpers/requestRecorder';
import { logTestStep } from '../../helpers/testProgressLogger';

const { withAcceptHandling } = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

/**
 * mcp-abap-adt#350 — the statements the live cases send, built here so their
 * columns are exact. Only `TDEVC` package names; read-only.
 */
const ITEM = 'A'.repeat(30);

/** An `IN` list on one line whose `'$TMP'` item spans column 255 (252–257). */
function longLineStatement(): string {
  const items = Array.from({ length: 6 }, () => `'${ITEM}'`);
  items.push("'AAAA'", "'$TMP'");
  return `SELECT devclass FROM tdevc WHERE devclass IN (${items.join(',')})`;
}

/** `IN (…)` closed at 255, then a condition past it that no row meets. */
function tailPast255Statement(): string {
  let statement = "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP'";
  while (255 - statement.length - 2 > 34) statement += `,'${ITEM}'`;
  statement += `,'${'Z'.repeat(255 - statement.length - 4)}')`;
  return `${statement} AND devclass = 'NOPE'`;
}

const LONG_LITERAL = 'L'.repeat(100);

/**
 * A literal followed by code with no blank: `concat( '<100>','B' )`, one line
 * under 255. ABAP SQL wants the blank after `concat(` (measured: without it SAP
 * answers `"(" is not allowed here`), so that is the valid form.
 */
function concatStatement(): string {
  return `SELECT devclass, concat( '${LONG_LITERAL}','B' ) AS x FROM tdevc WHERE devclass = '$TMP'`;
}

/** The values of a preview document's cells, in order — plain code. */
function cellsOf(document: string): string[] {
  const open = '<dataPreview:data>';
  const close = '</dataPreview:data>';
  const cells: string[] = [];
  let at = document.indexOf(open);
  while (at >= 0) {
    const end = document.indexOf(close, at);
    if (end < 0) break;
    cells.push(document.slice(at + open.length, end));
    at = document.indexOf(open, end);
  }
  return cells;
}

describe('Shared - getSqlQuery', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let isCloudSystem = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolvedClient;
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
            {
              analyse: analyseException,
              headers: integrationHeadersOf(client.getUtils(), 'getSqlQuery'),
            },
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
            {
              analyse: analyseException,
              headers: integrationHeadersOf(client.getUtils(), 'getSqlQuery'),
            },
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
      const answer = await client.getUtils().getSqlQuery(
        { sql_query: '' },
        {
          analyse: analyseException,
          headers: integrationHeadersOf(client.getUtils(), 'getSqlQuery'),
        },
      );
      if (answer.ok) throw new Error('expected an empty query to be refused');
      expect(answer.getError().message).toMatch(/\S/);
      testsLogger.info?.(`empty query refused: ${answer.getError().message}`);
    },
  );
  /**
   * Run one #350 statement through `getSqlQuery` over a recording connection,
   * logging what was sent (each line's length), what the wrap makes of the
   * statement, and SAP's answer when it refuses.
   */
  async function runStatement(statement: string): Promise<{
    cells: string[];
    sent: string[];
  }> {
    const recorder = recordRequests(connection);
    const utils = new AdtUtils(recorder.connection, {
      logger: testsLogger,
      results: utilDocuments,
    });
    const answer = await utils.getSqlQuery(
      { sql_query: statement, row_number: 5 },
      {
        analyse: analyseException,
        headers: integrationHeadersOf(utils, 'getSqlQuery'),
      },
    );
    const sent = recorder.requests.map((request) =>
      typeof request.data === 'string' ? request.data : '',
    );
    for (const body of sent) {
      testsLogger.info?.(
        `sent (${body
          .split('\n')
          .map((line) => line.length)
          .join(', ')}):\n${body}`,
      );
    }
    const expected = wrapSqlLines(statement);
    testsLogger.info?.(
      `expected after the fix (${expected
        .split('\n')
        .map((line) => line.length)
        .join(', ')}):\n${expected}`,
    );
    if (!answer.ok) {
      const error = answer.getError();
      testsLogger.info?.(
        `SAP refused: status ${error.response?.status ?? 'none'}, ${error.adtType ?? 'no adtType'}: ${error.message}`,
      );
    }
    const document = expectResult(answer, 'SQL query') as string;
    return { cells: cellsOf(document), sent };
  }

  gate('sql_query', 'execute_sql_query_long_line')(
    'answers the $TMP row for a one-line IN list whose item spans column 255',
    async () => {
      const statement = longLineStatement();
      expect(statement.indexOf("'$TMP'")).toBe(251);
      expect(statement.length).toBeGreaterThan(255);
      const { cells, sent } = await runStatement(statement);
      expect(cells).toContain('$TMP');
      expect(sent).toEqual([wrapSqlLines(statement)]);
    },
    30000,
  );

  gate('sql_query', 'execute_sql_query_tail_past_255')(
    'keeps a condition past column 255: no row',
    async () => {
      const statement = tailPast255Statement();
      expect(statement.indexOf(' AND ')).toBe(255);
      const { cells, sent } = await runStatement(statement);
      expect(cells).toEqual([]);
      expect(sent).toEqual([wrapSqlLines(statement)]);
    },
    30000,
  );

  gate('sql_query', 'execute_sql_query_concat_long_literal')(
    'answers a literal followed by code inside concat( ), whole',
    async () => {
      const statement = concatStatement();
      expect(statement.length).toBeLessThan(255);
      expect(statement.length).toBeGreaterThan(72);
      const { cells, sent } = await runStatement(statement);
      expect(cells).toContain(`${LONG_LITERAL}B`);
      expect(sent).toEqual([wrapSqlLines(statement)]);
    },
    30000,
  );
});
