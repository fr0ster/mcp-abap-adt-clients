/**
 * `extractSupportedAccept` imported from the package root, the way a consumer
 * does: a `406` names the acceptable media types in a header or in its body.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  AdtClient,
  cachedAccept,
  extractSupportedAccept,
  rememberAccept,
} from '../../index';
import { getAcceptCorrectionEnabled } from '../../utils/acceptNegotiation';

describe('extractSupportedAccept (package root)', () => {
  it('reads the supported types from a response header', () => {
    const error = {
      response: {
        status: 406,
        headers: {
          'x-sap-adt-supported-accept':
            'application/vnd.sap.adt.foo.v2+xml, application/vnd.sap.adt.foo.v1+xml',
        },
      },
    };
    expect(extractSupportedAccept(error)).toEqual([
      'application/vnd.sap.adt.foo.v2+xml',
      'application/vnd.sap.adt.foo.v1+xml',
    ]);
  });

  it('reads the supported types from the response body', () => {
    const error = {
      response: {
        status: 406,
        headers: {},
        data: 'Supported: application/vnd.sap.adt.bar.v3+xml',
      },
    };
    expect(extractSupportedAccept(error)).toEqual([
      'application/vnd.sap.adt.bar.v3+xml',
    ]);
  });

  it('answers an empty list for an error with no response', () => {
    expect(extractSupportedAccept(new Error('boom'))).toEqual([]);
  });
});

describe('cachedAccept / rememberAccept (package root)', () => {
  const request = {
    method: 'GET',
    url: '/sap/bc/adt/things',
    headers: { Accept: 'application/xml' },
  } as unknown as IAbapRequestOptions;

  function connectionAnswering(
    sent: Array<string | undefined>,
    first406?: string,
  ): IAbapConnection {
    let calls = 0;
    return {
      makeAdtRequest: async (r: IAbapRequestOptions) => {
        calls++;
        sent.push((r.headers as Record<string, string>)?.Accept);
        if (first406 && calls === 1) {
          const error: any = new Error('406');
          error.response = {
            status: 406,
            headers: { 'x-sap-adt-supported-accept': first406 },
          };
          throw error;
        }
        return { status: 200, headers: {}, data: '' };
      },
    } as unknown as IAbapConnection;
  }

  it('a remembered Accept is sent by a later request of an AdtClient', async () => {
    const sent: Array<string | undefined> = [];
    const connection = connectionAnswering(sent);
    new AdtClient(connection, undefined, { enableAcceptCorrection: true });

    rememberAccept(connection, request, 'application/vnd.sap.adt.t.v2+xml');
    await connection.makeAdtRequest(request);

    expect(sent).toEqual(['application/vnd.sap.adt.t.v2+xml']);
  });

  it('a correction made by the non-batch path is returned', async () => {
    const sent: Array<string | undefined> = [];
    const connection = connectionAnswering(
      sent,
      'application/vnd.sap.adt.t.v3+xml',
    );
    new AdtClient(connection, undefined, { enableAcceptCorrection: true });
    expect(cachedAccept(connection, request)).toBeUndefined();

    await connection.makeAdtRequest(request);

    expect(sent).toEqual([
      'application/xml',
      'application/vnd.sap.adt.t.v3+xml',
    ]);
    expect(cachedAccept(connection, request)).toBe(
      'application/vnd.sap.adt.t.v3+xml',
    );
  });
});

describe('correction is off unless switched on', () => {
  const request = {
    method: 'GET',
    url: '/sap/bc/adt/other',
    headers: { Accept: 'application/xml' },
  } as unknown as IAbapRequestOptions;
  const saved = process.env.ADT_ACCEPT_CORRECTION;
  afterEach(() => {
    if (saved === undefined) delete process.env.ADT_ACCEPT_CORRECTION;
    else process.env.ADT_ACCEPT_CORRECTION = saved;
  });

  function refusing406(): { connection: IAbapConnection; calls: () => number } {
    let calls = 0;
    const connection = {
      makeAdtRequest: async () => {
        calls++;
        const error: any = new Error('406');
        error.response = {
          status: 406,
          headers: { 'x-sap-adt-supported-accept': 'application/vnd.x+xml' },
        };
        throw error;
      },
    } as unknown as IAbapConnection;
    return { connection, calls: () => calls };
  }

  it('an AdtClient with no switch sends a 406 request once', async () => {
    delete process.env.ADT_ACCEPT_CORRECTION;
    const { connection, calls } = refusing406();
    new AdtClient(connection);
    await expect(connection.makeAdtRequest(request)).rejects.toThrow('406');
    expect(calls()).toBe(1);
    expect(getAcceptCorrectionEnabled(connection)).toBe(false);
  });

  it('ADT_ACCEPT_CORRECTION=true switches it on, any other value leaves it off', async () => {
    process.env.ADT_ACCEPT_CORRECTION = 'true';
    const on = refusing406();
    new AdtClient(on.connection);
    await expect(on.connection.makeAdtRequest(request)).rejects.toThrow('406');
    expect(on.calls()).toBe(2);

    process.env.ADT_ACCEPT_CORRECTION = '1';
    const off = refusing406();
    new AdtClient(off.connection);
    await expect(off.connection.makeAdtRequest(request)).rejects.toThrow('406');
    expect(off.calls()).toBe(1);
  });

  it('cachedAccept reads the cache with the switch off', () => {
    const { connection } = refusing406();
    new AdtClient(connection, undefined, { enableAcceptCorrection: false });
    rememberAccept(connection, request, 'application/vnd.x+xml');
    expect(cachedAccept(connection, request)).toBe('application/vnd.x+xml');
  });
});
