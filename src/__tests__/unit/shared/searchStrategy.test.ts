/**
 * `search` is one member over one endpoint, and the caller may read the answer.
 *
 * The old shape had two members over `/repository/informationsystem/search` —
 * `searchObjects` handing back the envelope and `search` handing back the hits —
 * which made "how far the answer was parsed" a property of which method was
 * called rather than of the contract. `IAdtInformationSystem` therefore names one
 * member with a strategy overload, and these cases assert the two things a
 * consumer moving off `searchObjects` depends on:
 *
 * - the parser is handed the **raw body**, untouched, not a re-serialised parse;
 * - the same request goes out either way, so choosing the strategy changes the
 *   reading and nothing else.
 *
 * The second is the one worth a test. A strategy that quietly issued a different
 * request would still return the caller's type and still compile.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from '../../../core/shared/AdtUtils';

const SEARCH_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">' +
  '<adtcore:objectReference adtcore:uri="/sap/bc/adt/oo/classes/zcl_a" ' +
  'adtcore:type="CLAS/OC" adtcore:name="ZCL_A"/>' +
  '</adtcore:objectReferences>';

interface Sent {
  url: string;
  method: string;
}

function createConnection() {
  const sent: Sent[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(
      async (request: { url: string; method: string }) => {
        sent.push({ url: String(request.url), method: String(request.method) });
        return { status: 200, statusText: 'OK', data: SEARCH_XML, headers: {} };
      },
    ),
  } as unknown as IAbapConnection;
  return { connection, sent };
}

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

describe('AdtUtils.search — one endpoint, the reading chosen by the caller', () => {
  it('hands the parser the raw body, and returns what the parser returned', async () => {
    const { connection } = createConnection();

    const seen: unknown[] = [];
    const result = await new AdtUtils(connection, logger).search(
      { query: 'ZCL_*' },
      (data) => {
        seen.push(data);
        return { length: String(data).length };
      },
    );

    // Untouched: the document the server sent, not a parse of it re-emitted.
    expect(seen).toEqual([SEARCH_XML]);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected a result');
    expect(result.getResult().value).toEqual({ length: SEARCH_XML.length });
  });

  it('issues the same request with the strategy as without it', async () => {
    const withParser = createConnection();
    await new AdtUtils(withParser.connection, logger).search(
      { query: 'ZCL_*' },
      (data) => String(data),
    );

    const withoutParser = createConnection();
    await new AdtUtils(withoutParser.connection, logger).search({
      query: 'ZCL_*',
    });

    expect(withParser.sent).toHaveLength(1);
    // The choice is about reading the answer. If these ever diverge, the
    // overload has become a second capability wearing one name.
    expect(withParser.sent).toEqual(withoutParser.sent);
  });

  it('without a parser still answers the parsed hits', async () => {
    const { connection } = createConnection();

    const hits = await new AdtUtils(connection, logger).search({
      query: 'ZCL_*',
    });

    expect(hits.ok).toBe(true);
    if (!hits.ok) throw new Error('expected a result');
    expect(hits.getResult().value).toEqual([
      expect.objectContaining({ name: 'ZCL_A', type: 'CLAS/OC' }),
    ]);
  });
});
