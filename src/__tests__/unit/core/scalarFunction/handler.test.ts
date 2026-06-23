import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtScalarFunction } from '../../../../core/scalarFunction/AdtScalarFunction';

type Call = { url: string; method?: string };
function makeConn(handler: (r: any) => Partial<IAdtResponse> | Error) {
  const sessionTypes: string[] = [];
  const calls: Call[] = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      calls.push({ url: r.url, method: r.method });
      const res = handler(r);
      if (res instanceof Error) throw res;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
        ...res,
      } as IAdtResponse;
    },
    setSessionType: (t: string) => {
      sessionTypes.push(t);
    },
  } as unknown as IAbapConnection;
  return { conn, sessionTypes, calls };
}

describe('AdtScalarFunction handler', () => {
  it('create() only POSTs metadata — no lock/update even if sourceCode is given', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const sf = new AdtScalarFunction(conn);
    await sf.create(
      {
        scalarFunctionName: 'ZOK_F',
        packageName: 'ZPKG',
        description: 'd',
        sourceCode: 'X',
      },
      { sourceCode: 'Y' },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/ddic/dsfd/sources');
  });

  it('read() returns undefined on 404', async () => {
    const { conn } = makeConn(() =>
      Object.assign(new Error('not found'), { response: { status: 404 } }),
    );
    const sf = new AdtScalarFunction(conn);
    const result = await sf.read({ scalarFunctionName: 'ZOK_F' });
    expect(result).toBeUndefined();
  });

  it('validate() maps 404/405/501 to validationSupported:false without throwing', async () => {
    const { conn } = makeConn(() =>
      Object.assign(new Error('nope'), { response: { status: 405 } }),
    );
    const sf = new AdtScalarFunction(conn);
    const state = await sf.validate({ scalarFunctionName: 'ZOK_F' });
    expect(state.validationSupported).toBe(false);
    expect(state.errors).toHaveLength(0);
  });

  it('validate() rethrows non-unsupported errors (e.g. 403)', async () => {
    const { conn } = makeConn(() =>
      Object.assign(new Error('forbidden'), { response: { status: 403 } }),
    );
    const sf = new AdtScalarFunction(conn);
    await expect(sf.validate({ scalarFunctionName: 'ZOK_F' })).rejects.toThrow(
      'forbidden',
    );
  });

  it('public unlock() resets session to stateless even when unlock throws', async () => {
    const { conn, sessionTypes } = makeConn((r) =>
      r.url.includes('_action=UNLOCK')
        ? new Error('unlock boom')
        : { data: '' },
    );
    const sf = new AdtScalarFunction(conn);
    await expect(
      sf.unlock({ scalarFunctionName: 'ZOK_F' }, 'LH1'),
    ).rejects.toThrow('unlock boom');
    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
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

    const sf = new AdtScalarFunction(conn);
    await sf.update({ scalarFunctionName: 'ZOK_X', sourceCode: 'new source' });

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
