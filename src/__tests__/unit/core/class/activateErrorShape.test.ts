/**
 * An activation failure keeps its code, status and body.
 *
 * `activate` moved from `AdtClass` into `AdtClassMemberBase` when the four
 * class-include handlers stopped extending `AdtClass`. The move was supposed to
 * be a relocation and was not: the catch block came from a different handler's
 * pattern, and a 4xx stopped arriving as an `AdtOperationError` carrying
 * `ACTIVATE_FAILED`, the status and up to 500 characters of the response —
 * which is the shape every other 4xx in that class produces and the shape
 * callers branch on. Caught in review, 2026-08-14; nothing else in the suite
 * exercised it.
 *
 * The base is abstract, so this goes through `AdtClass`; every include handler
 * inherits the same method.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtClass } from '../../../../core/class/AdtClass';
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
  it('a 4xx arrives as ACTIVATE_FAILED, with the status and the body', async () => {
    const cls = new AdtClass(
      failingWith(400, 'Object ZCL_X cannot be activated'),
      createLibraryLogger(),
    );

    await expect(cls.activate({ className: 'ZCL_X' })).rejects.toMatchObject({
      code: 'ADT_ACTIVATE_FAILED',
      status: 400,
      message: expect.stringContaining('cannot be activated'),
    });
  });

  it('a 5xx is re-thrown as it came, not reshaped', async () => {
    const cls = new AdtClass(failingWith(500, 'boom'), createLibraryLogger());

    await expect(cls.activate({ className: 'ZCL_X' })).rejects.toMatchObject({
      message: 'request failed',
    });
  });
});
