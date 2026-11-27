/**
 * The owner's decision D4 of #304: a value from outside the type system is
 * shape-checked where it fills a typed field. Intended changes for odd
 * values, each failing against the code before them:
 * - from a thrown value, `message` only when it is a string, `response` only
 *   when it is an object with an integer `status`, `request` as only its
 *   string `method` and `url`;
 * - a batch request's `params` only as a string, a `URLSearchParams` or a
 *   plain object of string, number or boolean values; anything else refused
 *   with the library's own error.
 * What well-formed values give is unchanged (the other suites).
 */
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import { AdtBatchConnection } from '../../../batch';
import { answering, recogniseFailure } from '../../../utils/adtResponse';
import { requestOf } from '../../../utils/requestTrace';
import { rawDocument } from '../../../utils/resultStrategy';

const wellFormed = {
  status: 404,
  statusText: 'Not Found',
  headers: {},
  data: 'x',
};

describe('a thrown value fills a failure only with what has its shape', () => {
  it('keeps a message only when it is a string', () => {
    expect(recogniseFailure({ message: 42 }).message).toBe(
      'The request did not complete',
    );
    expect(recogniseFailure({ message: 'said' }).message).toBe('said');
  });

  it('keeps a response only when its status is an integer', () => {
    expect(
      recogniseFailure({ response: { ...wellFormed, status: '404' } }).response,
    ).toBeUndefined();
    expect(
      recogniseFailure({ response: { ...wellFormed, status: 404.5 } }).response,
    ).toBeUndefined();
    expect(recogniseFailure({ response: 'text' }).response).toBeUndefined();
    expect(recogniseFailure({ response: wellFormed }).response).toBe(
      wellFormed,
    );
  });

  it('keeps of a request only its string method and url', () => {
    expect(
      recogniseFailure({ request: { method: 1, url: '/u', body: 'secret' } })
        .request,
    ).toEqual({ url: '/u' });
    expect(recogniseFailure({ request: 'GET /u' }).request).toBeUndefined();
  });

  it('answers no answer for a thrown response whose status is no integer', async () => {
    const answer = await answering(
      () => Promise.reject({ response: { ...wellFormed, status: '200' } }),
      rawDocument,
      () => ADT_NO_FAILURE,
    );
    expect(answer.ok).toBe(false);
  });

  it('reads of an answer’s request only its string method and url', () => {
    expect(
      requestOf({ ...wellFormed, request: { method: 5, url: '/x' } }),
    ).toEqual({ url: '/x' });
  });
});

describe('a batch request’s params', () => {
  const batch = () =>
    new AdtBatchConnection(
      {
        makeAdtRequest: async () => wellFormed,
        getBaseUrl: async () => 'https://example.test',
        getSessionId: () => null,
        setSessionType: () => undefined,
        connect: async () => undefined,
      },
      { endpoint: 'communication' },
    );
  const request = (params: unknown) => ({
    method: 'GET',
    url: '/u',
    timeout: 0,
    params,
  });

  it.each([
    ['an array', [['a', '1']]],
    ['a Map', new Map([['a', '1']])],
    [
      'a class instance',
      new (class Params {
        a = '1';
      })(),
    ],
    ['an object value', { a: { b: 1 } }],
    ['a number', 5],
  ])('refuses %s with the library’s own error', (_, params) => {
    expect(() => batch().makeAdtRequest(request(params))).toThrow(
      "a batch request's params must be a string, a URLSearchParams or a plain object of string, number or boolean values",
    );
  });

  it.each([
    ['a string', 'a=1'],
    ['a URLSearchParams', new URLSearchParams({ a: '1' })],
    ['a plain object', { a: '1', b: 2, c: true }],
    ['a null-prototype object', Object.assign(Object.create(null), { a: '1' })],
    ['undefined', undefined],
  ])('accepts %s', (_, params) => {
    expect(() => batch().makeAdtRequest(request(params))).not.toThrow();
  });
});
