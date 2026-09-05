import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import { AdtScalarFunction } from '../../../../core/scalarFunction/AdtScalarFunction';
import { expectFailure, expectResult } from '../../../helpers/contract';

type Call = { url: string; method?: string };
function makeConn(handler: (r: any) => Partial<IAdtWireResponse> | Error) {
  const sessionTypes: string[] = [];
  const calls: Call[] = [];
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

  it('read() answers a failure on 404', async () => {
    const { conn } = makeConn(() =>
      Object.assign(new Error('not found'), { response: { status: 404 } }),
    );
    const sf = new AdtScalarFunction(conn);
    // `undefined` for a 404 used to be the answer, and it read like an empty
    // object. It is a failure the caller can see in the type now.
    const failure = expectFailure(
      await sf.read({ scalarFunctionName: 'ZOK_F' }),
      'read a scalar function that is not there',
    );
    expect(failure.origin).toBe('connection');
  });

  it('validate() names 404/405/501 as unsupported, not as a bad name', async () => {
    const { conn } = makeConn(() =>
      Object.assign(new Error('nope'), { response: { status: 405 } }),
    );
    const sf = new AdtScalarFunction(conn);
    // Some systems have no validation resource at all. That is not a verdict
    // about the name — the shipped `analyse` names it, so a consumer branches
    // on the code rather than decoding a status.
    const failure = expectFailure(
      await sf.validate({ scalarFunctionName: 'ZOK_F' }),
      'validate where the resource is absent',
    );
    expect(failure.code).toBe(AdtObjectErrorCodes.UNSUPPORTED_OPERATION);
    expect(failure.message).toContain('405');
  });

  it('validate() reports non-unsupported errors as themselves (e.g. 403)', async () => {
    const { conn } = makeConn(() =>
      Object.assign(new Error('forbidden'), { response: { status: 403 } }),
    );
    const sf = new AdtScalarFunction(conn);

    // 403 is not in the unsupported set, so the shipped `analyse` leaves it
    // alone: a system that refused the caller is not a system without the
    // resource, and giving it the unsupported code would hide an authorization
    // problem behind a capability one.
    const failure = expectFailure(
      await sf.validate({ scalarFunctionName: 'ZOK_F' }),
      'validate refused with 403',
    );

    expect(failure.message).toContain('forbidden');
    expect(failure.code).toBeUndefined();
  });

  it('public unlock() resets session to stateless even when the unlock is refused', async () => {
    const { conn, sessionTypes } = makeConn((r) =>
      r.url.includes('_action=UNLOCK')
        ? new Error('unlock boom')
        : { data: '' },
    );
    const sf = new AdtScalarFunction(conn);

    const failure = expectFailure(
      await sf.unlock({ scalarFunctionName: 'ZOK_F' }, 'LH1'),
      'unlock the server refused',
    );

    expect(failure.message).toContain('unlock boom');
    // The session is what this case is about: a refused unlock that left the
    // client stateful poisons every later request on it.
    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
  });

  it('update() happy path: lock→check→PUT→long-poll-read→unlock→check, ends stateless', async () => {
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

    // The readiness poll waits on the version the write produced. It read
    // `version=active` once, which is the version the update cannot have
    // changed — see `updateNoActivateReadsInactive.test.ts` for the rule.
    const longPollCall = calls.find(
      (c) =>
        c.method === 'GET' &&
        c.url.includes('version=inactive') &&
        c.url.includes('withLongPolling=true'),
    );
    expect(longPollCall).toBeDefined();

    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
  });
});
