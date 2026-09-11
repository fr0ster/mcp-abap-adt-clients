import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import { AdtAppendStructure } from '../../../../core/appendStructure/AdtAppendStructure';
import { expectFailure, expectResult } from '../../../helpers/contract';

function makeConn(handler: (r: any) => Partial<IAdtWireResponse> | Error) {
  const sessionTypes: string[] = [];
  const calls: Array<{ url: string; method?: string }> = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtWireResponse> => {
      calls.push({ url: r.url, method: r.method });
      const res = handler(r);
      if (res instanceof Error) throw res;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
        ...res,
      } as IAdtWireResponse;
    },
    setSessionType: (t: string) => {
      sessionTypes.push(t);
    },
  } as unknown as IAbapConnection;
  return { conn, sessionTypes, calls };
}

describe('AdtAppendStructure handler', () => {
  it('create() only POSTs metadata (no lock/update) with a valid baseObject', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const as = new AdtAppendStructure(conn);
    await as.create({
      appendStructureName: 'ZOK_S',
      baseObject: 'ZBASE',
      packageName: 'ZPKG',
      description: 'd',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/ddic/structures');
  });

  it('public unlock() resets to stateless even when the unlock is refused', async () => {
    const { conn, sessionTypes } = makeConn((r) =>
      r.url.includes('_action=UNLOCK')
        ? new Error('unlock boom')
        : { data: '' },
    );
    const as = new AdtAppendStructure(conn);

    const failure = expectFailure(
      await as.unlock({ appendStructureName: 'ZOK_S' }, 'LH1'),
      'unlock the server refused',
    );

    expect(failure.message).toContain('unlock boom');
    // The session is what this case is about: a refused unlock that left the
    // client stateful poisons every later request on it.
    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
  });

  it('validate() names 501 as unsupported, not as a bad name', async () => {
    const { conn } = makeConn(() =>
      Object.assign(new Error('nope'), { response: { status: 501 } }),
    );
    const as = new AdtAppendStructure(conn);
    // A system with no validation resource has not looked at the name. The
    // shipped `analyse` says so with a code, so a consumer branches on that
    // rather than on a status they would have to dig out themselves.
    const failure = expectFailure(
      await as.validate({ appendStructureName: 'ZOK_S' }),
      'validate where the resource is absent',
    );
    expect(failure.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(failure.message).toContain('501');
  });

  it('update() is the PUT, and it carries the handle it was given', async () => {
    const { conn, sessionTypes, calls } = makeConn(() => ({ data: '' }));

    const as = new AdtAppendStructure(conn);
    await as.update(
      { appendStructureName: 'ZOK_X' },
      { sourceCode: 'new source', lockHandle: 'LOCK_HANDLE_42' },
    );

    // One request, and it is the write. No lock, no check, no readiness poll:
    // those are calls the consumer makes when it wants them.
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toContain('/source/main');
    expect(calls[0].url).toContain('lockHandle=LOCK_HANDLE_42');

    // And the session is the consumer's: the member did not touch it.
    expect(sessionTypes).toEqual([]);
  });
});
