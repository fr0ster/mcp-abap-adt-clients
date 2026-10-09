/**
 * The low level requests; it does not resolve.
 *
 * `listTransports` had five filter parameters the server never read, so the call
 * returned a 309-byte empty root for two weeks while 15 requests sat on the
 * system. These fix the two halves of the replacement: one request, always, to
 * the configUri form. The configurations reader moved to adt-strategies.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { listTransports } from '../../../../core/transport/list';

const recordingConnection = (body: string) => {
  const calls: IAbapRequestOptions[] = [];
  const connection = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    setSessionType: () => {},
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      calls.push(options);
      return {
        data: body,
        status: 200,
        statusText: 'OK',
        headers: {},
      } as unknown as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { connection, calls };
};

describe('listTransports issues one request and never resolves', () => {
  it('puts configUri in the query, encoded', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await listTransports(connection, {
      configUri:
        '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      '/sap/bc/adt/cts/transportrequests?configUri=' +
        '%2Fsap%2Fbc%2Fadt%2Fcts%2Ftransportrequests%2Fsearchconfiguration%2Fconfigurations%2F7E5B',
    );
    expect(calls[0].headers?.Accept).toBe(
      'application/vnd.sap.adt.transportorganizertree.v1+xml',
    );
  });

  it('never touches the configurations endpoint, whatever it is given', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await listTransports(connection, { configUri: '/x' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).not.toContain('searchconfiguration');
  });

  it('refuses an empty configUri rather than sending the request that returns nothing', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await expect(listTransports(connection, { configUri: '' })).rejects.toThrow(
      /configUri/,
    );
    expect(calls).toHaveLength(0);
  });
});
