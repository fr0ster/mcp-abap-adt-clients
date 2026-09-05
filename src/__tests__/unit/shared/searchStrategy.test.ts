/**
 * `search` is one member over one endpoint, and the reading is the caller's.
 *
 * The old shape had two members over `/repository/informationsystem/search` —
 * `searchObjects` handing back the envelope and `search` handing back the hits
 * — and then `search` itself took a `parse` argument. "How far the answer was
 * parsed" was therefore a property of which method you called and what you
 * passed it, rather than of the implementation you were handed.
 *
 * 31.0.0 removed both. The reading is injected once, when the implementation is
 * built, and these cases assert the two things a consumer moving off the old
 * shape depends on:
 *
 * - an injected reading is handed the **raw body**, untouched, not a
 *   re-serialised parse;
 * - the same request goes out either way, so the reading changes what comes
 *   back and nothing else.
 *
 * The second is the one worth a test. A reading that quietly issued a different
 * request would still return the caller's type and still compile.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { expectResult } from '../../helpers/contract';

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

describe('AdtUtils.search — one endpoint, the reading injected once', () => {
  it('hands an injected reading the raw body, and answers what it returned', async () => {
    const { connection } = createConnection();

    const seen: unknown[] = [];
    const utils = new AdtUtils(connection, logger, {
      ...utilDocuments,
      search: (answer) => {
        seen.push(answer.data);
        return { length: String(answer.data).length };
      },
    });

    const value = expectResult(
      await utils.search({ query: 'ZCL_*' }),
      'search',
    );

    // Untouched: the document the server sent, not a parse of it re-emitted.
    expect(seen).toEqual([SEARCH_XML]);
    expect(value).toEqual({ length: SEARCH_XML.length });
  });

  it('issues the same request whichever reading it was built with', async () => {
    const injected = createConnection();
    await new AdtUtils(injected.connection, logger, {
      ...utilDocuments,
      search: (answer) => String(answer.data),
    }).search({ query: 'ZCL_*' });

    const shipped = createConnection();
    await new AdtUtils(shipped.connection, logger).search({ query: 'ZCL_*' });

    expect(injected.sent).toHaveLength(1);
    // The reading is about the answer. If these ever diverge, it has become a
    // second capability wearing one name.
    expect(injected.sent).toEqual(shipped.sent);
  });

  it('the shipped reading answers the parsed hits', async () => {
    const { connection } = createConnection();

    const hits = expectResult(
      await new AdtUtils(connection, logger).search({ query: 'ZCL_*' }),
      'search',
    );

    expect(hits).toEqual([
      expect.objectContaining({ name: 'ZCL_A', type: 'CLAS/OC' }),
    ]);
  });
});
