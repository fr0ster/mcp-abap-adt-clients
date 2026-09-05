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
  it('create() requires baseObject', async () => {
    const { conn } = makeConn(() => ({ data: '' }));
    const as = new AdtAppendStructure(conn);
    await expect(
      as.create({
        appendStructureName: 'ZOK_S',
        packageName: 'ZPKG',
        description: 'd',
      }),
    ).rejects.toThrow(/base/i);
  });

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

  it('public unlock() resets to stateless even when unlock throws', async () => {
    const { conn, sessionTypes } = makeConn((r) =>
      r.url.includes('_action=UNLOCK')
        ? new Error('unlock boom')
        : { data: '' },
    );
    const as = new AdtAppendStructure(conn);
    await expect(
      as.unlock({ appendStructureName: 'ZOK_S' }, 'LH1'),
    ).rejects.toThrow('unlock boom');
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

  it('update() happy path: lock→check→PUT→long-poll-read→unlock→check→read, ends stateless', async () => {
    const LOCK_HANDLE = 'LOCK_HANDLE_42';
    const lockXml = `<?xml version="1.0" encoding="utf-8"?>
<asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
    <DATA>
      <LOCK_HANDLE>${LOCK_HANDLE}</LOCK_HANDLE>
    </DATA>
  </asx:values>
</asx:abap>`;

    const { conn, sessionTypes, calls } = makeConn((r) => {
      if (r.url.includes('_action=LOCK')) return { data: lockXml };
      if (r.url.includes('checkruns')) return { data: '' };
      if (r.method === 'PUT') return { data: '' };
      if (r.url.includes('_action=UNLOCK')) return { data: '' };
      if (r.method === 'GET') return { data: 'source code' };
      return { data: '' };
    });

    const as = new AdtAppendStructure(conn);
    await as.update({ appendStructureName: 'ZOK_X', sourceCode: 'new source' });

    const putCall = calls.find((c) => c.method === 'PUT');
    expect(putCall).toBeDefined();
    expect(putCall?.url).toContain('/source/main');

    const longPollCall = calls.find(
      (c) =>
        c.method === 'GET' &&
        c.url.includes('version=active') &&
        c.url.includes('withLongPolling=true'),
    );
    expect(longPollCall).toBeDefined();

    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
  });
});
