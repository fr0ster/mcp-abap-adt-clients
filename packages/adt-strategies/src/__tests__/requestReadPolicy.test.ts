import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { analyseException } from '../refusals/analyse';
import { answerFor } from './corpus';

/**
 * K5 of #304: the request a failure carries is read as a direct read read it
 * before the casts went (spec 3.5, `propertyOf`): inherited properties and
 * getters included, from an object or a function, nothing from a primitive.
 */
const data = answerFor('refusal-lock-held-by-other').data;
const verdictFor = (request: unknown) => {
  const answer: IAdtWireResponse = {
    data,
    status: 403,
    statusText: 'Forbidden',
    headers: {},
    request,
  };
  const verdict = analyseException(ADT_NO_FAILURE, answer);
  return verdict === ADT_NO_FAILURE ? undefined : verdict.request;
};

describe('the request is read as a direct read read it', () => {
  it('reads inherited fields', () => {
    const request = Object.create({ method: 'GET', url: '/inherited' });
    expect(verdictFor(request)).toEqual({ method: 'GET', url: '/inherited' });
  });

  it('runs a getter', () => {
    const request = {
      get url() {
        return '/got';
      },
    };
    expect(verdictFor(request)).toEqual({ method: undefined, url: '/got' });
  });

  it('reads the fields of a function', () => {
    const request = Object.assign(() => undefined, {
      method: 'POST',
      url: '/fn',
    });
    expect(verdictFor(request)).toEqual({ method: 'POST', url: '/fn' });
  });

  it.each([
    ['a string', 'GET /x'],
    ['a number', 7],
    ['null', null],
  ])('reads nothing from %s', (_, request) => {
    expect(verdictFor(request)).toBeUndefined();
  });
});
