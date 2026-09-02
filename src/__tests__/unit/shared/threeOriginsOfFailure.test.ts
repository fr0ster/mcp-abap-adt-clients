/**
 * Three things can go wrong, and a caller must be able to tell which.
 *
 * | what happened | what reaches the caller |
 * |---|---|
 * | SAP refused | `AdtSAPError` — the server's message and document |
 * | this library could not read the answer | `AdtParseError` — what it looked for, and the document |
 * | the caller's own parser threw | their exception, untouched |
 *
 * Before the second existed, it looked like a *result*: a document the library
 * could not read parsed to nothing and went back as an empty list. A logon page —
 * what an expired session answers with — read as "the package is empty".
 *
 * The third is left alone on purpose. Wrapping it would put this library's name
 * on a failure that is not its own, and a caller debugging their parser would
 * have to unwrap to find their own stack.
 *
 * The fourth case is the one that must NOT be an error: an empty answer. Nothing
 * matched is a result, and turning it into a failure would break every honest
 * empty read.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtUtils } from '../../../core/shared/AdtUtils';
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

const failureFrom = async (call: Promise<unknown>) =>
  call.then(
    (value) => {
      throw new Error(
        `expected a failure, got ${JSON.stringify(value)?.slice(0, 80)}`,
      );
    },
    (error: unknown) => error,
  );

class ConsumerParserBug extends Error {
  constructor() {
    super('the consumer parser blew up');
    this.name = 'ConsumerParserBug';
  }
}

describe('the three origins stay apart', () => {
  it('SAP refused — the server speaks', async () => {
    const utils = new AdtUtils(answering(REFUSAL), logger);

    const error = await failureFrom(utils.getAllTypes());

    expect(error).toBeInstanceOf(AdtSAPError);
    expect((error as Error).message).toContain('locked by user XYZ');
  });

  it('this library could not read it — the library says so, and hands it back', async () => {
    const utils = new AdtUtils(answering(LOGON_PAGE), logger);

    const error = await failureFrom(utils.getAllTypes());

    // Not "no types exist". The distinction this class was added for.
    expect(error).toBeInstanceOf(AdtParseError);
    const unreadable = error as AdtParseError;
    expect(unreadable.expected).toBe('nameditem:namedItemList');
    expect(unreadable.document).toBe(LOGON_PAGE);
  });

  it("the caller's parser threw — their error, untouched", async () => {
    const utils = new AdtUtils(
      answering('<adtcore:objectReferences xmlns:adtcore="x"/>'),
      logger,
    );

    const error = await failureFrom(
      utils.search({ query: 'Z*' }, () => {
        throw new ConsumerParserBug();
      }),
    );

    // Not wrapped, not renamed. Putting this library's name on a failure that is
    // not its own would send a caller looking in the wrong place.
    expect(error).toBeInstanceOf(ConsumerParserBug);
    expect(error).not.toBeInstanceOf(AdtParseError);
    expect(error).not.toBeInstanceOf(AdtSAPError);
  });

  it('nothing matched — still a result, still not a failure', async () => {
    const utils = new AdtUtils(answering(EMPTY_LEVEL), logger);

    await expect(utils.fetchNodeStructure('DEVC/K', 'ZEMPTY')).resolves.toEqual(
      { objects: [], childNodes: [] },
    );
  });
});
