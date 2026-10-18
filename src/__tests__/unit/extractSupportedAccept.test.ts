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

/**
 * SAP's own 406, as measured on an on-premise system: the exception document,
 * whose message ends "Accepted content types: …" — the list is often empty —
 * and no header naming the types. Its namespace URI used to come back from
 * the parser as two "types" (`www.sap.com/abapxml`,
 * `types/communicationframework`) on every 406.
 */
function sap406(accepted: string): string {
  const message = `The message content is not acceptable. Accepted content types: ${accepted}`;
  return (
    '<?xml version="1.0" encoding="utf-8"?>' +
    '<exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
    '<namespace id="com.sap.adt"/>' +
    '<type id="ExceptionResourceNotAcceptable"/>' +
    `<message lang="EN">${message}</message>` +
    `<localizedMessage lang="EN">${message}</localizedMessage>` +
    '<properties/></exc:exception>'
  );
}

describe('extractSupportedAccept (package root)', () => {
  it('reads the types SAP lists after "Accepted content types:"', () => {
    const error = {
      response: {
        status: 406,
        headers: { 'content-type': 'application/xml' },
        data: sap406(
          'application/vnd.sap.adt.foo.v2+xml, application/vnd.sap.adt.foo.v1+xml',
        ),
      },
    };
    expect(extractSupportedAccept(error)).toEqual([
      'application/vnd.sap.adt.foo.v2+xml',
      'application/vnd.sap.adt.foo.v1+xml',
    ]);
  });

  it('answers an empty list when SAP lists none', () => {
    const error = {
      response: { status: 406, headers: {}, data: sap406('') },
    };
    expect(extractSupportedAccept(error)).toEqual([]);
  });

  it('never answers a fragment of the exception namespace', () => {
    const error = {
      response: {
        status: 406,
        headers: {},
        data: sap406('application/vnd.sap.as+xml'),
      },
    };
    const types = extractSupportedAccept(error);
    expect(types).toEqual(['application/vnd.sap.as+xml']);
    expect(types).not.toContain('www.sap.com/abapxml');
    expect(types).not.toContain('types/communicationframework');
  });

  it('reads no header: SAP names the types in the body only', () => {
    const error = {
      response: {
        status: 406,
        headers: {
          accept: 'application/xml',
          'x-sap-adt-supported-accept': 'application/vnd.sap.adt.foo.v2+xml',
        },
        data: sap406(''),
      },
    };
    expect(extractSupportedAccept(error)).toEqual([]);
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
            headers: {},
            data: sap406(first406),
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
          headers: {},
          data: sap406('application/vnd.x+xml'),
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
