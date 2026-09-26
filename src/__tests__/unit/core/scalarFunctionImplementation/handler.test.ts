import { analyseUnsupportedStatus } from '@mcp-abap-adt/adt-strategies';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtScalarFunctionImplementation } from '../../../../core/scalarFunctionImplementation/AdtScalarFunctionImplementation';
import { expectFailure } from '../../../helpers/contract';

function makeConn(handler: (r: any) => Partial<IAdtWireResponse> | Error) {
  const sessionTypes: string[] = [];
  const calls: Array<{
    url: string;
    method?: string;
    headers?: Record<string, string>;
  }> = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtWireResponse> => {
      calls.push({ url: r.url, method: r.method, headers: r.headers });
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

const LOCK_XML =
  '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH1</LOCK_HANDLE></DATA></asx:values></asx:abap>';

describe('AdtScalarFunctionImplementation handler', () => {
  it('create() is metadata-only (one POST, no lock/update)', async () => {
    const { conn, calls } = makeConn(() => ({ data: '' }));
    const h = new AdtScalarFunctionImplementation(conn);
    // No source either way — the create is the POST of the metadata document.
    await h.create({
      implementationName: 'ZI',
      scalarFunctionName: 'ZF',
      packageName: 'ZP',
      description: 'd',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/ddic/dsfi');
  });

  it('update() is the PUT on /source/main, with the handle it was given', async () => {
    const { conn, calls, sessionTypes } = makeConn(() => ({ data: '' }));
    const h = new AdtScalarFunctionImplementation(conn);
    await h.update(
      { implementationName: 'ZI', scalarFunctionName: 'ZF' },
      { source: 'src', lockHandle: 'LOCK_HANDLE_42' },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('PUT');
    expect(calls[0].url).toContain('/sap/bc/adt/ddic/dsfi/zi/source/main');
    expect(calls[0].url).toContain('lockHandle=LOCK_HANDLE_42');
    // A DSFI's source is JSON, unlike every neighbouring type's.
    expect(calls[0].headers?.['Content-Type']).toBe('application/json');
    expect(sessionTypes).toEqual([]);
  });

  it('updateMetadata() is the PUT on the object itself, in blues v2', async () => {
    const { conn, calls, sessionTypes } = makeConn(() => ({ data: '' }));
    const h = new AdtScalarFunctionImplementation(conn);
    await h.updateMetadata(
      { implementationName: 'ZI' },
      { source: '<blues/>', lockHandle: 'LOCK_HANDLE_42' },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toMatch(/\/sap\/bc\/adt\/ddic\/dsfi\/zi\?lockHandle=/);
    expect(calls[0].url).not.toContain('/source/main');
    expect(calls[0].headers?.['Content-Type']).toBe(
      'application/vnd.sap.adt.blues.v2+xml; charset=utf-8',
    );
    expect(sessionTypes).toEqual([]);
  });

  it('read() answers a failure on 404', async () => {
    const { conn } = makeConn(() =>
      Object.assign(new Error('nf'), { response: { status: 404 } }),
    );
    const h = new AdtScalarFunctionImplementation(conn);
    // `undefined` used to be the answer, and it read like an empty object.
    expect(
      expectFailure(
        await h.read({ implementationName: 'ZI' }),
        'read an implementation that is not there',
      ).origin,
    ).toBe('connection');
  });

  it('validate() answers 405 as it came, a strategy names it; public unlock resets stateless on throw', async () => {
    const v = makeConn(() =>
      Object.assign(new Error('no'), { response: { status: 405 } }),
    );
    const hv = new AdtScalarFunctionImplementation(v.conn);
    // Some systems have no validation resource. That is not a verdict about
    // the name; the library reports the status as it came, and a caller who
    // wants it named passes the reading that names it.
    expect(
      expectFailure(
        await hv.validate({ implementationName: 'ZI' }),
        'validate where the resource is absent',
      ).code,
    ).not.toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(
      expectFailure(
        await hv.validate(
          { implementationName: 'ZI' },
          {
            analyse: analyseUnsupportedStatus(
              [404, 405, 501],
              'name validation',
            ),
          },
        ),
        'validate where the resource is absent, read by the strategy',
      ).code,
    ).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);

    const u = makeConn((r) =>
      r.url.includes('_action=UNLOCK') ? new Error('boom') : { data: '' },
    );
    const hu = new AdtScalarFunctionImplementation(u.conn);
    expect(
      expectFailure(
        await hu.unlock({ implementationName: 'ZI' }, 'LH1'),
        'unlock the server refused',
      ).message,
    ).toContain('boom');
    // A refused unlock that left the client stateful poisons every later
    // request on the same connection.
    expect(u.sessionTypes[u.sessionTypes.length - 1]).toBe('stateless');
  });
});
