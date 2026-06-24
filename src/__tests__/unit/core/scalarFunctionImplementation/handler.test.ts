import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtScalarFunctionImplementation } from '../../../../core/scalarFunctionImplementation/AdtScalarFunctionImplementation';

function makeConn(handler: (r: any) => Partial<IAdtResponse> | Error) {
  const sessionTypes: string[] = [];
  const calls: Array<{ url: string; method?: string }> = [];
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

const LOCK_XML =
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH1</LOCK_HANDLE></DATA></asx:values></asx:abap>';

describe('AdtScalarFunctionImplementation handler', () => {
  it('create() requires scalarFunctionName', async () => {
    const { conn } = makeConn(() => ({ data: '' }));
    const h = new AdtScalarFunctionImplementation(conn);
    await expect(
      h.create({
        implementationName: 'ZI',
        packageName: 'ZP',
        description: 'd',
      } as any),
    ).rejects.toThrow(/scalar function/i);
  });

  it('create() is metadata-only (one POST, no lock/update)', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const h = new AdtScalarFunctionImplementation(conn);
    await h.create(
      {
        implementationName: 'ZI',
        scalarFunctionName: 'ZF',
        packageName: 'ZP',
        description: 'd',
        sourceCode: 'x',
      },
      { sourceCode: 'y' },
    );
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/ddic/dsfi');
  });

  it('update() happy path: PUT then long-poll GET(active,withLongPolling); ends stateless', async () => {
    const { conn, calls, sessionTypes } = makeConn((r) => {
      if (r.url.includes('_action=LOCK')) return { data: LOCK_XML };
      return { data: '' };
    });
    const h = new AdtScalarFunctionImplementation(conn);
    await h.update({
      implementationName: 'ZI',
      scalarFunctionName: 'ZF',
      sourceCode: 'src',
    });
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toContain('/sap/bc/adt/ddic/dsfi/zi?');
    expect(put?.url).not.toContain('/source/main');
    const poll = calls.find(
      (c) =>
        c.method === 'GET' &&
        c.url.includes('/sap/bc/adt/ddic/dsfi/zi?') &&
        c.url.includes('version=active') &&
        c.url.includes('withLongPolling=true'),
    );
    expect(poll).toBeDefined();
    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
  });

  it('read() returns undefined on 404', async () => {
    const { conn } = makeConn(() =>
      Object.assign(new Error('nf'), { response: { status: 404 } }),
    );
    const h = new AdtScalarFunctionImplementation(conn);
    expect(await h.read({ implementationName: 'ZI' })).toBeUndefined();
  });

  it('validate() maps 405 → validationSupported:false; public unlock resets stateless on throw', async () => {
    const v = makeConn(() =>
      Object.assign(new Error('no'), { response: { status: 405 } }),
    );
    const hv = new AdtScalarFunctionImplementation(v.conn);
    expect(
      (await hv.validate({ implementationName: 'ZI' })).validationSupported,
    ).toBe(false);

    const u = makeConn((r) =>
      r.url.includes('_action=UNLOCK') ? new Error('boom') : { data: '' },
    );
    const hu = new AdtScalarFunctionImplementation(u.conn);
    await expect(
      hu.unlock({ implementationName: 'ZI' }, 'LH1'),
    ).rejects.toThrow('boom');
    expect(u.sessionTypes[u.sessionTypes.length - 1]).toBe('stateless');
  });
});
