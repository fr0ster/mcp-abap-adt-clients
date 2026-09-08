/**
 * Three things can go wrong, and a caller must be able to tell which.
 *
 * | what happened | what reaches the caller |
 * |---|---|
 * | SAP refused | the failure half, `origin: 'refusal'` — the server's message and document |
 * | no answer arrived at all | the failure half, `origin: 'connection'` |
 * | a reading could not read the answer | its exception, thrown past the contract |
 *
 * The first two are verdicts *about the server*, and those are the only two
 * origins `interfaces@31.0.0` has. The third is deliberately not one of them: a
 * document this library could not read is this library's failure, not SAP's, and
 * calling it `origin: 'parse'` told a caller to go and look at a system that had
 * answered them correctly.
 *
 * It is also not wrapped. Whether the reading is the shipped one or a
 * consumer's, its exception surfaces as itself — renaming it would put this
 * library's name on a failure that is not its own, and a caller debugging their
 * own reading would have to unwrap to find their own stack.
 *
 * Before any of this existed the unreadable case looked like a *result*: a
 * document the library could not read parsed to nothing and went back as an
 * empty list. A logon page — what an expired session answers with — read as
 * "the package is empty".
 *
 * The last case is the one that must NOT be an error: an empty answer. Nothing
 * matched is a result, and turning it into a failure would break every honest
 * empty read.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { AdtParseError, AdtSAPError } from '../../../utils/adtErrors';

const REFUSAL =
  '<exc:exception xmlns:exc="http://www.sap.com/adt/exception">' +
  '<message lang="EN">Object ZNOPE is locked by user XYZ</message>' +
  '</exc:exception>';

/** What an expired session answers with, in place of the document asked for. */
const LOGON_PAGE = '<html><body>Logon</body></html>';

const EMPTY_LEVEL =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA>' +
  '<TREE_CONTENT/><OBJECT_TYPES/></DATA></asx:values></asx:abap>';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

const answering = (data: string): IAbapConnection =>
  ({
    setSessionType: jest.fn(),
    isConnected: () => true,
    makeAdtRequest: jest.fn(async () => ({
      status: 200,
      statusText: 'OK',
      data,
      headers: {},
    })),
  }) as unknown as IAbapConnection;

class ConsumerParserBug extends Error {
  constructor() {
    super('the consumer parser blew up');
    this.name = 'ConsumerParserBug';
  }
}

describe('the three origins stay apart', () => {
  it('SAP refused — the server speaks, in the failure half', async () => {
    const utils = new AdtUtils(answering(REFUSAL), logger);

    const response = await utils.getAllTypes();

    // The contract carries it back rather than throwing past the caller: an
    // exception is invisible to the type system, and `ok` is not.
    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected a failure');
    expect(response.getError().origin).toBe('refusal');
    expect(response.getError().message).toContain('locked by user XYZ');
    // The origin is the assertion that matters: it is what tells a caller which
    // remedy applies, and a wrong one sends them at the wrong system.
    expect(response.getError().origin).not.toBe('connection');
  });

  it('this library could not read it — thrown, not "no types"', async () => {
    const utils = new AdtUtils(answering(LOGON_PAGE), logger);

    // Not an empty list, and not a verdict about SAP either: the server
    // answered, the shipped reading could not make types out of a logon page,
    // and that is this library failing rather than the system refusing.
    await expect(utils.getAllTypes()).rejects.toBeInstanceOf(AdtParseError);
  });

  it("a consumer's own reading threw — their error, untouched", async () => {
    const utils = new AdtUtils(
      answering('<adtcore:objectReferences xmlns:adtcore="x"/>'),
      logger,
      {
        ...utilDocuments,
        search: () => {
          throw new ConsumerParserBug();
        },
      },
    );

    const error = await utils.search({ query: 'Z*' }).then(
      (answer) => {
        throw new Error(
          `expected the reading's own error, got ${JSON.stringify(answer.ok)}`,
        );
      },
      (e: unknown) => e,
    );

    // Not wrapped, not classified, not renamed. It surfaces as itself.
    //
    // An earlier version of this case checked only that the error survived in
    // `cause` — and passed while the library was labelling it
    // `origin: 'connection'`, which tells a caller to reauthenticate or check
    // the network over a bug in their own reading. A test that reads the
    // payload and not the classification cannot see that.
    expect(error).toBeInstanceOf(ConsumerParserBug);
    expect(error).not.toBeInstanceOf(AdtParseError);
    expect(error).not.toBeInstanceOf(AdtSAPError);
  });

  it('nothing matched — still a result, still not a failure', async () => {
    const utils = new AdtUtils(answering(EMPTY_LEVEL), logger);

    const response = await utils.fetchNodeStructure('DEVC/K', 'ZEMPTY');

    // The fourth case, and the one that must NOT become a failure: nothing
    // matched is an answer, and `ok` says so.
    expect(response.ok).toBe(true);
    if (!response.ok) throw new Error('expected a result');
    expect(response.getResult().value).toEqual({
      objects: [],
      childNodes: [],
    });
  });
});

describe('a legacy refusal is an answer, not a throw', () => {
  it('answers a failure where the endpoint is absent', async () => {
    const { AdtUtilsLegacy } = await import(
      '../../../core/shared/AdtUtilsLegacy'
    );
    const utils = new AdtUtilsLegacy(answering(EMPTY_LEVEL), logger);

    const response = await utils.getSqlQuery({ sql_query: 'SELECT 1' });

    // Two implementations of one member must behave alike in shape. Throwing
    // here would make the legacy one unlike the modern one for a reason the
    // caller cannot see in the type — the substitution decision 13 is about.
    expect(response.ok).toBe(false);
    if (response.ok) throw new Error('expected a failure');

    // `connection`, not `refusal`: the endpoint is not there. Same remedy as an
    // unreachable host — a different system, not a different question.
    expect(response.getError().origin).toBe('connection');
    expect(response.getError().message).toContain('legacy');
  });
});
