/**
 * The SQL tools set no deadline of their own; the caller's stands as given.
 *
 * `getSqlQuery` (`/datapreview/freestyle`) and `getTableContents`
 * (`/datapreview/ddic`) used to put `getTimeout('long')` on their request —
 * `SAP_TIMEOUT_LONG`, 120 s by default. A caller whose connection applies its
 * own deadline only where the request carries none never got to apply it: the
 * library's 120 s was always there first. Since 31.0.0 the request carries
 * `timeout: 0` — none, in the contract's words: the field is a required
 * number, and 0 is what the wires read as "do not abort" — so with nothing from
 * the caller no deadline is set, and a caller's 5000 stays 5000.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { getSqlQuery } from '../../../core/shared/sqlQuery';
import { getTableContents } from '../../../core/shared/tableContents';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { headersFor, headersOf } from '../../helpers/adtHeaders';

function recordingConnection() {
  const sent: IAbapRequestOptions[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (request: IAbapRequestOptions) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', data: '', headers: {} };
    }),
  } as unknown as IAbapConnection;
  return { connection, sent };
}

/** A caller's connection that applies its deadline where the request has none (0). */
function withCallerDeadline(
  connection: IAbapConnection,
  timeout: number,
): IAbapConnection {
  return {
    ...connection,
    makeAdtRequest: (request: IAbapRequestOptions) =>
      connection.makeAdtRequest({
        ...request,
        timeout: request.timeout || timeout,
      }),
  } as IAbapConnection;
}

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const calls: Array<[string, (c: IAbapConnection) => Promise<unknown>]> = [
  [
    'getSqlQuery',
    (c) =>
      getSqlQuery(c, headersFor('AdtUtils.getSqlQuery'), {
        sql_query: 'SELECT * FROM T000',
      }),
  ],
  [
    'getTableContents',
    (c) =>
      getTableContents(c, headersFor('AdtUtils.getTableContents'), {
        table_name: 't000',
        sql_query: 'SELECT T000~MANDT FROM T000',
      }),
  ],
  [
    'AdtUtils.getSqlQuery',
    (c) =>
      new AdtUtils(c, logger, utilDocuments).getSqlQuery(
        {
          sql_query: 'SELECT * FROM T000',
        },
        {
          headers: headersOf(
            new AdtUtils(c, logger, utilDocuments),
            'getSqlQuery',
          ),
        },
      ),
  ],
  [
    'AdtUtils.getTableContents',
    (c) =>
      new AdtUtils(c, logger, utilDocuments).getTableContents(
        {
          table_name: 't000',
          sql_query: 'SELECT T000~MANDT FROM T000',
        },
        {
          headers: headersOf(
            new AdtUtils(c, logger, utilDocuments),
            'getTableContents',
          ),
        },
      ),
  ],
];

describe('the SQL tools set no timeout of their own', () => {
  it.each(
    calls,
  )('%s sends no timeout when the caller sets none', async (_name, call) => {
    const { connection, sent } = recordingConnection();
    await call(connection);
    expect(sent).toHaveLength(1);
    expect(sent[0].timeout).toBe(0);
  });

  it.each(
    calls,
  )("%s keeps the caller's timeout as given", async (_name, call) => {
    const { connection, sent } = recordingConnection();
    await call(withCallerDeadline(connection, 5000));
    expect(sent).toHaveLength(1);
    expect(sent[0].timeout).toBe(5000);
  });
});
