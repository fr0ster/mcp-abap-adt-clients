/**
 * `getSqlQuery` sends its statement wrapped at 72 (mcp-abap-adt#350).
 *
 * The freestyle preview keeps 255 characters of each line and drops the rest
 * (measured), so the member sends `wrapSqlLines` of the caller's statement: a
 * long line broken at blanks and after commas, never inside a literal. What is
 * asserted is the `data` the connection received, as a string — the request
 * boundary. A statement that fits goes out as given; nothing is refused, so a
 * statement SAP refuses is answered with SAP's refusal after one request.
 * `getTableContents` (`/datapreview/ddic`, which reads a long line whole,
 * measured) sends its statement as given.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { headersOf } from '../../helpers/adtHeaders';

const logger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

/** SAP's measured answer to a statement with a `"` inside a literal. */
function sapRefusal(): Error {
  return Object.assign(new Error('Request failed with status code 400'), {
    response: {
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      data:
        '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
        '<namespace id="com.sap.adt"/><type id="ExceptionDataPreviewGeneral"/>' +
        '<message lang="EN">Literals across more than one line are not allowed.</message>' +
        '</exc:exception>',
    },
    request: { method: 'POST', url: '/sap/bc/adt/datapreview/freestyle' },
  });
}

function recordingConnection(refuse = false) {
  const sent: IAbapRequestOptions[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async (request: IAbapRequestOptions) => {
      sent.push(request);
      if (refuse) throw sapRefusal();
      return { status: 200, statusText: 'OK', data: '', headers: {} };
    }),
  } as unknown as IAbapConnection;
  const utils = new AdtUtils(connection, { logger, results: utilDocuments });
  return { utils, sent };
}

async function sentFor(statement: string): Promise<IAbapRequestOptions> {
  const { utils, sent } = recordingConnection();
  await utils.getSqlQuery(
    { sql_query: statement, row_number: 5 },
    { headers: headersOf(utils, 'getSqlQuery') },
  );
  expect(sent).toHaveLength(1);
  const request = sent[0];
  if (request === undefined) throw new Error('no request was sent');
  return request;
}

const ITEMS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((c) => c.repeat(30));

/** The issue's statement: one line of 299 characters, `'GGG…'` at 245–276. */
const ISSUE = `SELECT devclass FROM tdevc WHERE devclass IN (${ITEMS.map((i) => `'${i}'`).join(',')},'Z_FLIGHT_ADDITIONAL')`;

/** `IN (…)` closed at 255, then a condition SAP drops when it is past 255. */
function tailPast255(): string {
  let statement = "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP'";
  while (255 - statement.length - 2 > 34) statement += `,'${'A'.repeat(30)}'`;
  statement += `,'${'Z'.repeat(255 - statement.length - 4)}')`;
  return `${statement} AND devclass = 'NOPE'`;
}

describe('getSqlQuery sends its statement wrapped at 72', () => {
  it("sends the issue's statement wrapped, each item whole", async () => {
    expect(ISSUE).toHaveLength(299);
    expect(ISSUE.indexOf(`'${ITEMS[6]}'`)).toBe(244);
    const request = await sentFor(ISSUE);
    expect(request.data).toBe(
      [
        'SELECT devclass FROM tdevc WHERE devclass IN',
        `('${ITEMS[0]}','${ITEMS[1]}',`,
        `'${ITEMS[2]}','${ITEMS[3]}',`,
        `'${ITEMS[4]}','${ITEMS[5]}',`,
        `'${ITEMS[6]}','Z_FLIGHT_ADDITIONAL')`,
      ].join('\n'),
    );
  });

  it('sends the condition past 255 on a line of its own', async () => {
    const statement = tailPast255();
    expect(statement.indexOf(' AND ')).toBe(255);
    const request = await sentFor(statement);
    const a = `'${'A'.repeat(30)}'`;
    expect(request.data).toBe(
      [
        "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP',",
        `${a},${a},`,
        `${a},${a},`,
        `${a},${a},'Z')`,
        "AND devclass = 'NOPE'",
      ].join('\n'),
    );
  });

  it.each([
    ["'", 10],
    ["'", 30],
    ['`', 10],
    ['`', 30],
  ])(
    'sends a %s literal of %i0 characters byte-identical, alone on its line',
    async (delimiter, count) => {
      const literal = `${delimiter}${'LLLLLLLL, '.repeat(count)}${delimiter}`;
      const request = await sentFor(
        `SELECT devclass FROM tdevc WHERE devclass IN ('$TMP', ${literal}, 'X')`,
      );
      expect(request.data).toBe(
        [
          "SELECT devclass FROM tdevc WHERE devclass IN ('$TMP',",
          `${literal},`,
          "'X')",
        ].join('\n'),
      );
    },
  );

  it('sends a statement with a " inside a literal, and answers SAP\'s refusal after one request', async () => {
    const statement = `SELECT devclass FROM tdevc WHERE devclass = 'A"B, ${'word, '.repeat(12)}' OR devclass = '$TMP'`;
    const { utils, sent } = recordingConnection(true);
    const answer = await utils.getSqlQuery(
      { sql_query: statement, row_number: 5 },
      { headers: headersOf(utils, 'getSqlQuery') },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.data).toBe(
      [
        'SELECT devclass FROM tdevc WHERE devclass =',
        `'A"B, ${'word, '.repeat(12)}'`,
        "OR devclass = '$TMP'",
      ].join('\n'),
    );
    expect(answer.ok).toBe(false);
    if (answer.ok) throw new Error('expected a failure');
    expect(answer.getError().response?.status).toBe(400);
  });

  it('sends a statement that fits as given', async () => {
    const statement = 'SELECT * FROM T000';
    const request = await sentFor(statement);
    expect(request.data).toBe(statement);
  });

  it('keeps the request otherwise as it was', async () => {
    const request = await sentFor(ISSUE);
    expect(request.url).toBe('/sap/bc/adt/datapreview/freestyle?rowNumber=5');
    expect(request.method).toBe('POST');
    expect(request.timeout).toBe(0);
    expect(request.headers).toEqual({
      Accept: expect.any(String),
      'Content-Type': expect.any(String),
    });
  });

  it('getTableContents sends a long statement as given', async () => {
    const { utils, sent } = recordingConnection();
    const statement = tailPast255().split('devclass').join('TDEVC~DEVCLASS');
    await utils.getTableContents(
      { table_name: 'TDEVC', sql_query: statement },
      { headers: headersOf(utils, 'getTableContents') },
    );
    expect(sent).toHaveLength(1);
    expect(sent[0]?.data).toBe(statement);
  });
});
