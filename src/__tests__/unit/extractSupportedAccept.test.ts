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
