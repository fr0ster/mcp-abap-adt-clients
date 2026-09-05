/**
 * An activation failure keeps its status and its body.
 *
 * `activate` moved from `AdtClass` into `AdtClassMemberBase` when the four
 * class-include handlers stopped extending `AdtClass`. The move was supposed to
 * be a relocation and was not: the catch block came from a different handler's
 * pattern, and a 4xx stopped arriving with the status and the response body,
 * which is what callers branch on. Caught in review, 2026-08-14; nothing else
 * in the suite exercised it.
 *
 * What changed since is where it arrives. It is the failure half of the answer
 * now, not a thrown `AdtOperationError` — so the assertions read `getError()`
 * rather than a rejection, and the status and the document come back on
 * `response` instead of on invented fields. The claim is the same one: a caller
 * must be able to see what the server said and how it said it.
 *
 * The base is abstract, so this goes through `AdtClass`; every include handler
 * inherits the same method.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtClass } from '../../../../core/class/AdtClass';
import { expectFailure } from '../../../helpers/contract';
import { createLibraryLogger } from '../../../helpers/testLogger';

function failingWith(status: number, data: string): IAbapConnection {
  return {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async () => {
      throw Object.assign(new Error('request failed'), {
        response: { status, statusText: 'Bad Request', data },
      });
    },
  } as unknown as IAbapConnection;
}

describe('activation failure keeps its shape', () => {
  it('a 4xx arrives as a failure carrying the status and the body', async () => {
    const cls = new AdtClass(
      failingWith(400, 'Object ZCL_X cannot be activated'),
      createLibraryLogger(),
    );

    const failure = expectFailure(
      await cls.activate({ className: 'ZCL_X' }),
      'activate a class the server refuses',
    );

    // `connection`, not `refusal`: the transport refused the status, so this is
    // the answer never arriving rather than SAP answering "no" — which is the
    // distinction a caller acts on.
    expect(failure.origin).toBe('connection');
    expect(failure.response?.status).toBe(400);
    expect(failure.response?.data).toContain('cannot be activated');
  });

  it('a 5xx keeps what came, not something reshaped', async () => {
    const cls = new AdtClass(failingWith(500, 'boom'), createLibraryLogger());

    const failure = expectFailure(
      await cls.activate({ className: 'ZCL_X' }),
      'activate against a server that failed',
    );

    expect(failure.message).toBe('request failed');
    expect(failure.response?.status).toBe(500);
    expect(failure.response?.data).toBe('boom');
  });
});
