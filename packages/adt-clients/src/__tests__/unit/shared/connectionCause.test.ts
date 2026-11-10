/**
 * A connection failure names its cause by code (interfaces-adt 27.1.0,
 * `IAdtError.connectionCause`), so a consumer answers "no connection" without
 * reading the message.
 *
 * The thrown value comes from below the ADT conversation — outside the type
 * system — so its `code` is read as an own data property (a getter is never
 * run) and kept only when it is one of `ADT_CONNECTION_CAUSES`. Every other
 * field is what it was before the cause was added.
 */

import { ADT_CONNECTION_CAUSES } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtSAPError } from '../../../utils/adtErrors';
import { answering } from '../../../utils/adtResponse';
import { rawDocument } from '../../../utils/resultStrategy';

/** The failure `answering` makes of what the request threw. */
async function failureOf(thrown: unknown) {
  const answer = await answering(async () => {
    throw thrown;
  }, rawDocument);
  if (answer.ok) throw new Error('expected a failure');
  return answer.getError();
}

/** A value shaped as a socket's failure: a message and an own `code`. */
function socketError(code: unknown, message = 'the socket failed'): Error {
  return Object.assign(new Error(message), { code });
}

describe('a connection failure names its cause by code', () => {
  it.each(ADT_CONNECTION_CAUSES)('carries a listed code: %s', async (code) => {
    const failure = await failureOf(socketError(code));

    expect(failure.origin).toBe('connection');
    expect(failure.connectionCause).toBe(code);
  });

  it.each([
    'EPIPE',
    'ECONNABORTED',
    'ERR_BAD_RESPONSE',
    'CERT_HAS_EXPIRED',
    'econnrefused',
    ' ECONNREFUSED',
    '',
  ])('names no cause for a code off the list: %j', async (code) => {
    const failure = await failureOf(socketError(code));

    expect(failure.origin).toBe('connection');
    expect('connectionCause' in failure).toBe(false);
  });

  it.each([
    ['a number', 111],
    ['null', null],
    ['an object', { toString: () => 'ECONNREFUSED' }],
    ['an array', ['ECONNREFUSED']],
  ])('names no cause for a code that is %s', async (_, code) => {
    const failure = await failureOf(socketError(code));

    expect('connectionCause' in failure).toBe(false);
  });

  it('names no cause when nothing carries a code', async () => {
    const failure = await failureOf(new Error('the socket failed'));

    expect('connectionCause' in failure).toBe(false);
  });

  it('does not read the message: a listed code in the words is no cause', async () => {
    const failure = await failureOf(
      new Error('connect ECONNREFUSED 127.0.0.1:1'),
    );

    expect(failure.message).toBe('connect ECONNREFUSED 127.0.0.1:1');
    expect('connectionCause' in failure).toBe(false);
  });

  it('never runs a getter for the code, and names no cause from one', async () => {
    let read = 0;
    const thrown = new Error('the socket failed');
    Object.defineProperty(thrown, 'code', {
      get() {
        read += 1;
        throw new Error('a getter must not run');
      },
    });

    const failure = await failureOf(thrown);

    expect(read).toBe(0);
    expect(failure.origin).toBe('connection');
    expect('connectionCause' in failure).toBe(false);
  });

  it('reads only an own code, not one the prototype supplies', async () => {
    const thrown = Object.create({ code: 'ECONNREFUSED' });

    const failure = await failureOf(thrown);

    expect('connectionCause' in failure).toBe(false);
  });

  it.each([
    ['a string', 'ECONNREFUSED'],
    ['undefined', undefined],
    ['a number', 111],
  ])('names no cause when the thrown value is %s', async (_, thrown) => {
    const failure = await failureOf(thrown);

    expect(failure.origin).toBe('connection');
    expect('connectionCause' in failure).toBe(false);
  });

  it('leaves every other field as it was', async () => {
    const response: IAdtWireResponse = {
      data: '',
      status: 503,
      statusText: 'Service Unavailable',
      headers: {},
    };
    const request = { method: 'GET', url: '/sap/bc/adt/discovery' };
    const thrown = Object.assign(new Error('the socket failed'), {
      code: 'ECONNRESET',
      response,
      request,
    });

    const failure = await failureOf(thrown);

    expect(failure).toEqual({
      origin: 'connection',
      message: 'the socket failed',
      response,
      request,
      connectionCause: 'ECONNRESET',
    });
    expect(failure.response).toBe(response);
    expect(failure.request).toBe(request);
  });

  it('names no cause for a refusal, whatever the error carries', async () => {
    const refusal = Object.assign(
      new AdtSAPError(
        'SAP refused the request',
        '<exc/>',
        undefined,
        undefined,
        {
          data: '<exc/>',
          status: 403,
          statusText: 'Forbidden',
          headers: {},
        },
      ),
      { code: 'ECONNREFUSED' },
    );

    const failure = await failureOf(refusal);

    expect(failure.origin).toBe('refusal');
    expect('connectionCause' in failure).toBe(false);
  });

  it('names no cause for the credential SAP refused with a 401', async () => {
    // The connection's refusal, by the shape this library recognises it by:
    // own `refusal` and `at`, SAP's 401 one level down as the cause.
    const unauthorized: IAdtWireResponse = {
      data: '',
      status: 401,
      statusText: 'Unauthorized',
      headers: {},
    };
    const thrown = Object.assign(new Error('the credential was refused'), {
      code: 'ECONNRESET',
      refusal: { kind: 'credential-refused', reason: 'refused' },
      at: 'request',
      cause: Object.assign(new Error('Request failed with status code 401'), {
        code: 'ECONNRESET',
        response: unauthorized,
        request: { method: 'GET', url: '/sap/bc/adt/discovery' },
      }),
    });

    const failure = await failureOf(thrown);

    expect(failure.origin).toBe('connection');
    expect(failure.response).toBe(unauthorized);
    expect('connectionCause' in failure).toBe(false);
  });
});
