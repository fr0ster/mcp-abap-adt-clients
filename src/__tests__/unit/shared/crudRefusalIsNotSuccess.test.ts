/**
 * A CRUD chain must not report success when SAP refused.
 *
 * The status code is the channel; the response is the result. ADT answers some
 * refusals with a 2xx and an `<exc:exception>` document, so the transport admits
 * it and every layer above stores the body as a result. Measured before the fix,
 * with a connection answering 200 and "Object ZNOPE is locked by user XYZ" to
 * everything:
 *
 * | call | `state.errors` | what the caller was told |
 * |---|---|---|
 * | `create()` | 0 | the object was created |
 * | `delete()` | 0 | the object was deleted |
 * | `activate()` | 0 | the object was activated |
 *
 * Three of those are writes, which is what makes it sharp: a caller believed an
 * object existed that did not, and that one was deleted that was not.
 *
 * These cases assert the throw AND the message, because a throw carrying the
 * library's own guess would pass the first half while losing the only part worth
 * having — `XYZ`, the user actually holding the lock.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { AdtClient } from '../../../clients/AdtClient';
import { AdtSAPError } from '../../../utils/adtErrors';

const HOLDER = 'Object ZNOPE is locked by user XYZ';

const REFUSAL =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<exc:exception xmlns:exc="http://www.sap.com/adt/exception">' +
  '<namespace id="com.sap.adt"/>' +
  '<type id="ExceptionResourceNotFound"/>' +
  `<message lang="EN">${HOLDER}</message>` +
  '</exc:exception>';

const logger = {
  log: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as unknown as ILogger;

/** Answers 200 and a refusal to everything, and counts what was sent. */
function refusingConnection() {
  const sent: string[] = [];
  const connection = {
    connect: jest.fn(),
    isConnected: () => true,
    setSessionType: jest.fn(),
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    makeAdtRequest: jest.fn(
      async (request: { method: string; url: string }) => {
        sent.push(`${request.method} ${String(request.url).split('?')[0]}`);
        return { status: 200, statusText: 'OK', data: REFUSAL, headers: {} };
      },
    ),
  } as unknown as IAbapConnection;
  return { connection, sent };
}

const refusalFrom = async (call: Promise<unknown>) =>
  call.then(
    (value) => {
      throw new Error(
        `expected a refusal, got a result: ${JSON.stringify(value)?.slice(0, 120)}`,
      );
    },
    (error: unknown) => error,
  );

describe('a refusal carried by a 2xx is not a result', () => {
  it.each([
    [
      'create',
      (c: AdtClient) =>
        c
          .getClass()
          .create({ className: 'ZNOPE', description: 'd', packageName: 'ZP' }),
    ],
    ['delete', (c: AdtClient) => c.getClass().delete({ className: 'ZNOPE' })],
    [
      'activate',
      (c: AdtClient) => c.getClass().activate({ className: 'ZNOPE' }),
    ],
    ['read', (c: AdtClient) => c.getClass().read({ className: 'ZNOPE' })],
  ])('class.%s raises what SAP said', async (_name, call) => {
    const { connection } = refusingConnection();

    const error = await refusalFrom(call(new AdtClient(connection, logger)));

    expect(error).toBeInstanceOf(AdtSAPError);
    // The server's own words, including who holds the lock. A throw carrying
    // "may be locked by another user" would satisfy a weaker assertion and tell
    // the caller nothing they can act on.
    expect((error as Error).message).toContain(HOLDER);
    const refusal = error as AdtSAPError;
    expect(refusal.document).toBe(REFUSAL);

    // Enough for the consumer to do their own analysis and decide: what the
    // server said, how it classified it, the response it came on, and WHICH
    // call produced it. Without the request, a chain's steps are
    // indistinguishable — `delete()` sends two, `create()` sends six, and
    // "locked" means a different thing at each.
    expect(refusal.adtType).toBe('ExceptionResourceNotFound');
    expect(refusal.namespace).toBe('com.sap.adt');
    expect(refusal.response?.status).toBe(200);
    expect(refusal.request?.method).toBeDefined();
    expect(refusal.request?.url).toContain('/sap/bc/adt/');
  });

  it('stops the chain rather than continuing on a false premise', async () => {
    const { connection, sent } = refusingConnection();

    await refusalFrom(
      new AdtClient(connection, logger)
        .getClass()
        .delete({ className: 'ZNOPE' }),
    );

    // Before the fix this chain issued its second request after the first had
    // already been refused, then answered `errors: []`.
    expect(sent).toHaveLength(1);
  });

  it('leaves a real answer alone', async () => {
    const connection = {
      connect: jest.fn(),
      isConnected: () => true,
      setSessionType: jest.fn(),
      makeAdtRequest: jest.fn(async () => ({
        status: 200,
        statusText: 'OK',
        data: '<?xml version="1.0"?><class:abapClass xmlns:class="http://www.sap.com/adt/oo/classes"/>',
        headers: {},
      })),
    } as unknown as IAbapConnection;

    const state = await new AdtClient(connection, logger)
      .getClass()
      .read({ className: 'ZREAL' });

    expect(state?.errors).toEqual([]);
  });
});

describe('the check installs alongside accept negotiation, not against it', () => {
  it('does not re-enter when both wrappers are on one connection', async () => {
    // A Proxy was the first attempt and recursed: accept-negotiation keys a
    // WeakMap by the connection object to remember the original method, and a
    // proxy is a different object from its target, so the two wrappers called
    // each other until the stack ran out. This asserts one request goes out per
    // call, which is what that bug destroyed.
    const { connection, sent } = refusingConnection();
    const client = new AdtClient(connection, logger, {
      enableAcceptCorrection: true,
    });

    await refusalFrom(client.getClass().read({ className: 'ZNOPE' }));

    expect(sent).toHaveLength(1);
  });
});
