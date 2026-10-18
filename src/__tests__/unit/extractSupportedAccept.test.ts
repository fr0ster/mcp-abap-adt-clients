/**
 * `extractSupportedAccept` imported from the package root, the way a consumer
 * does: a `406` names the acceptable media types in its body.
 *
 * And, since 36.0.0, what nothing does with them: accept negotiation is gone,
 * so a `406` is the call's answer, nothing is sent again, and nothing learned
 * from it reaches a later request.
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient, extractSupportedAccept } from '../../index';

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

describe('a 406 is the answer, and nothing is remembered', () => {
  const saved = process.env.ADT_ACCEPT_CORRECTION;
  afterEach(() => {
    if (saved === undefined) delete process.env.ADT_ACCEPT_CORRECTION;
    else process.env.ADT_ACCEPT_CORRECTION = saved;
  });

  /** A connection whose first request SAP answers 406, naming a type. */
  function answering406First() {
    const sent: Array<{ method: string; url: string; headers: unknown }> = [];
    const connection = {
      connect: async () => {},
      getBaseUrl: async () => 'https://example',
      getSessionId: () => null,
      setSessionType: () => {},
      makeAdtRequest: async (request: {
        method: string;
        url: string;
        headers?: Record<string, string>;
      }) => {
        sent.push({
          method: request.method,
          url: request.url,
          headers: { ...request.headers },
        });
        if (sent.length === 1) {
          const error = Object.assign(new Error('406'), {
            response: {
              status: 406,
              headers: {},
              data: sap406('application/vnd.sap.adt.corrected.v9+xml'),
            },
          });
          throw error;
        }
        return { status: 200, statusText: 'OK', headers: {}, data: '' };
      },
    } as unknown as IAbapConnection;
    return { connection, sent };
  }

  it('a member sends exactly its pair after the same request was answered 406', async () => {
    // The old switch, set: nothing reads it any more.
    process.env.ADT_ACCEPT_CORRECTION = 'true';
    const { connection, sent } = answering406First();
    const cls = new AdtClient(connection).getClass();
    const config = {
      className: 'ZCL_GUARD',
      packageName: '$TMP',
      description: 'guard',
    };
    const first: IAdtHeaders = {
      accept: 'application/x-test-accept-first',
      contentType: 'application/x-test-ct-first',
    };
    const second: IAdtHeaders = {
      accept: 'application/x-test-accept-second',
      contentType: 'application/x-test-ct-second',
    };

    const refused = await cls.create(config, { headers: first });
    expect(refused.ok).toBe(false);
    // Sent once: no retry with the type the 406 named.
    expect(sent).toHaveLength(1);

    await cls.create(config, { headers: second });

    expect(sent).toHaveLength(2);
    expect(sent[1]?.method).toBe(sent[0]?.method);
    expect(sent[1]?.url).toBe(sent[0]?.url);
    expect(sent[1]?.headers).toEqual({
      Accept: second.accept,
      'Content-Type': second.contentType,
    });
  });
});
