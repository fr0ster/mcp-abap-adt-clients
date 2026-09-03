/**
 * A refusal from SAP must reach the caller whole.
 *
 * There are three ways a refusal arrives, and they are not the same shape:
 *
 * 1. **A failing status.** The transport throws and attaches the response —
 *    status, headers and body. `adt-clients` must not catch, wrap or summarise
 *    it on the way past.
 * 2. **200 with `<exc:exception>`.** The transport succeeded, so nothing throws
 *    below. Before these members were typed, the caller got the document and
 *    could read it. After typing, a parser stands in between — and a parser that
 *    finds no nodes in an exception document reports "nothing here" while the
 *    server said "no". That is the case these tests exist for.
 * 3. **200 with a genuinely empty result.** Not a refusal. It must stay an empty
 *    result, or every legitimate "nothing found" becomes an error.
 *
 * The third is why this cannot be "throw whenever the parse yields nothing".
 * Telling 2 from 3 is the whole job.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { AdtSAPError } from '../../../utils/adtErrors';
import { orThrow } from '../../../utils/adtResponse';

const MESSAGE = 'Resource ZNOPE does not exist';

const EXCEPTION_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<exc:exception xmlns:exc="http://www.sap.com/adt/exception">' +
  '<namespace id="com.sap.adt"/>' +
  '<type id="ExceptionResourceNotFound"/>' +
  `<message lang="EN">${MESSAGE}</message>` +
  `<localizedMessage lang="EN">${MESSAGE}</localizedMessage>` +
  '</exc:exception>';

const EMPTY_NODE_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA>' +
  '<TREE_CONTENT/><OBJECT_TYPES/>' +
  '</DATA></asx:values></asx:abap>';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

/** A connection that answers with one status and body, throwing like the real one. */
function connectionAnswering(status: number, data: string): IAbapConnection {
  return {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(async () => {
      const response = {
        status,
        statusText: status === 200 ? 'OK' : 'Error',
        data,
        headers: { 'content-type': 'application/xml' },
      };
      if (status < 200 || status >= 300) {
        const error = new Error(
          `Request failed with status ${status}`,
        ) as Error & { response: typeof response };
        error.response = response;
        throw error;
      }
      return response;
    }),
  } as unknown as IAbapConnection;
}

describe('a failing status reaches the caller, in the failure half', () => {
  it.each([
    [
      'fetchNodeStructure',
      (u: AdtUtils) => u.fetchNodeStructure('PROG/P', 'Z'),
    ],
    ['getAllTypes', (u: AdtUtils) => u.getAllTypes()],
    ['search', (u: AdtUtils) => u.search({ query: 'Z*' })],
  ])('%s', async (_name, call) => {
    const utils = new AdtUtils(connectionAnswering(404, EXCEPTION_XML), logger);

    const response = await call(utils);

    // Members on the contract answer with the failure; `searchObjects` is not on
    // it and still throws, which is why it is asserted separately below.
    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected a failure');

    const failure = response.getError();
    // Nothing in this library shortened it: the status the transport refused and
    // the body it refused with are both still here.
    expect(failure.origin).toBe('connection');
    expect(failure.response?.status).toBe(404);
    expect(failure.response?.data).toBe(EXCEPTION_XML);
  });
});

describe('200 carrying an exception document is a refusal, not an empty result', () => {
  it('fetchNodeStructure throws with the message and the whole document', async () => {
    const utils = new AdtUtils(connectionAnswering(200, EXCEPTION_XML), logger);

    const error = await orThrow(
      utils.fetchNodeStructure('PROG/P', 'ZNOPE'),
    ).then(
      () => {
        throw new Error('expected a rejection');
      },
      (e: unknown) => e,
    );

    // Before this, the answer was { objects: [], childNodes: [] } — the server's
    // "does not exist" reported to the caller as "there is nothing here".
    expect(error).toBeInstanceOf(AdtSAPError);
    const refusal = error as AdtSAPError;
    expect(refusal.message).toContain(MESSAGE);
    expect(refusal.document).toBe(EXCEPTION_XML);
    expect(refusal.adtType).toBe('ExceptionResourceNotFound');
    expect(refusal.namespace).toBe('com.sap.adt');
  });

  it('getAllTypes throws rather than answering an empty list', async () => {
    const utils = new AdtUtils(connectionAnswering(200, EXCEPTION_XML), logger);

    const error = await orThrow(utils.getAllTypes()).then(
      () => {
        throw new Error('expected a rejection');
      },
      (e: unknown) => e as AdtSAPError,
    );

    expect(error).toBeInstanceOf(AdtSAPError);
    expect(error.document).toBe(EXCEPTION_XML);
  });

  it("keeps the document even when the exception's own XML will not parse", async () => {
    const truncated = '<exc:exception><message>cut off here';
    const utils = new AdtUtils(connectionAnswering(200, truncated), logger);

    const error = await orThrow(utils.getAllTypes()).then(
      () => {
        throw new Error('expected a rejection');
      },
      (e: unknown) => e as AdtSAPError,
    );

    // A refusal that cannot be read is still a refusal. What the library cannot
    // interpret it hands over instead of discarding.
    expect(error).toBeInstanceOf(AdtSAPError);
    expect(error.document).toBe(truncated);
  });
});

describe('200 with a genuinely empty result stays an empty result', () => {
  it('an empty node structure is not an error', async () => {
    const utils = new AdtUtils(
      connectionAnswering(200, EMPTY_NODE_XML),
      logger,
    );

    // The distinction this whole file is about: "nothing matched" is an answer,
    // and turning it into a failure would break every legitimate empty read.
    const response = await utils.fetchNodeStructure('PROG/P', 'ZEMPTY');
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('expected a result');
    expect(response.getResult().value).toEqual({
      objects: [],
      childNodes: [],
    });
  });

  it('an empty named-item list is not an error', async () => {
    const empty =
      '<nameditem:namedItemList xmlns:nameditem="http://www.sap.com/adt/nameditems"/>';
    const utils = new AdtUtils(connectionAnswering(200, empty), logger);

    const response = await utils.getAllTypes();
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('expected a result');
    expect(response.getResult().value).toEqual([]);
  });
});

describe('a strategy must not become a place a refusal can hide', () => {
  it('never runs the parser on an exception document', async () => {
    const utils = new AdtUtils(connectionAnswering(200, EXCEPTION_XML), logger);

    const seen: unknown[] = [];
    const response = await utils.search({ query: 'Z*' }, (data) => {
      seen.push(data);
      return String(data);
    });

    // The parser is not called at all. Handing it the refusal would look
    // harmless — the document arrives — but a parser looking for hits in an
    // exception document finds none and answers "nothing found". The strategy is
    // there to control how much of a large answer the caller takes, not to
    // decide whether the request was refused.
    expect(seen).toEqual([]);
    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected a failure');
    expect(response.getError().origin).toBe('refusal');
    expect(response.getError().response?.data).toBe(EXCEPTION_XML);
  });

  it('still hands over a real answer untouched', async () => {
    const document = '<adtcore:objectReferences/>';
    const utils = new AdtUtils(connectionAnswering(200, document), logger);

    const response = await utils.search({ query: 'Z*' }, (data) =>
      String(data),
    );
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('expected a result');
    expect(response.getResult().value).toBe(document);
  });
});
