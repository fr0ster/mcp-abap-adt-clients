/**
 * The low level requests; it does not resolve.
 *
 * `listTransports` had five filter parameters the server never read, so the call
 * returned a 309-byte empty root for two weeks while 15 requests sat on the
 * system. The parameters it takes now are the ones SAP's handler reads
 * (`CL_CTS_ADT_TM_RES_COLL_CONT`, `GET_QUERY_PARAMETER`), measured on premise
 * 2026-11-18: `user`, `requestStatus`, `requestType`, `targets`,
 * `releasedFromDate`, `releasedToDate` — or a saved search's `configUri`. One
 * request, always, carrying exactly what it was given. The configurations
 * reader moved to adt-strategies.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtRequest } from '../../../../core/transport/AdtRequest';
import { listTransports } from '../../../../core/transport/list';
import {
  type ListTransportsParams,
  transportDocuments,
} from '../../../../core/transport/types';

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

  it('sends the configUri it is given, an empty one too: no runtime refusal', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await listTransports(connection, { configUri: '' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/sap/bc/adt/cts/transportrequests?configUri=');
  });
});

describe('listTransports by user, with no saved configuration', () => {
  const BASE = '/sap/bc/adt/cts/transportrequests';

  it('sends the user and the status letters, and nothing else', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await listTransports(connection, {
      user: 'DEVELOPER',
      requestStatus: ['D'],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${BASE}?user=DEVELOPER&requestStatus=D`);
    expect(calls[0].method).toBe('GET');
    expect(calls[0].headers?.Accept).toBe(
      'application/vnd.sap.adt.transportorganizertree.v1+xml',
    );
  });

  it('sends every parameter given, letters in the order given, each value encoded', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await listTransports(connection, {
      user: '/NS/DEV&X=1',
      requestStatus: ['R', 'D'],
      requestType: ['W', 'K'],
      targets: true,
      releasedFromDate: '20261101',
      releasedToDate: '2026 11#18',
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      `${BASE}?user=%2FNS%2FDEV%26X%3D1&requestStatus=RD&requestType=WK` +
        '&targets=true&releasedFromDate=20261101&releasedToDate=2026%2011%2318',
    );
  });

  it('sends a request type without targets', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await listTransports(connection, {
      user: 'DEVELOPER',
      requestStatus: ['D', 'R'],
      requestType: ['T'],
    });

    expect(calls[0].url).toBe(
      `${BASE}?user=DEVELOPER&requestStatus=DR&requestType=T`,
    );
  });

  it('goes through AdtRequest.list() as the same one request', async () => {
    const { connection, calls } = recordingConnection('<tm:root/>');

    await new AdtRequest(connection, { results: transportDocuments }).list({
      user: 'DEVELOPER',
      requestStatus: ['D'],
      requestType: ['K', 'W'],
      targets: true,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      `${BASE}?user=DEVELOPER&requestStatus=D&requestType=KW&targets=true`,
    );
  });

  /**
   * SAP answers `targets=true` without a `requestType` with an empty
   * `<tm:root/>` (measured on premise), so the type requires one beside
   * `targets`. The rules below are the compiler's; nothing checks them at
   * run time, and `npm run test:check` fails if one stops being refused.
   */
  it('holds the rules in the type', () => {
    const refused: ListTransportsParams[] = [
      // @ts-expect-error -- targets without a requestType answers nothing
      { user: 'U', requestStatus: ['D'], targets: true },
      // @ts-expect-error -- no status selects nothing
      { user: 'U', requestStatus: [] },
      // @ts-expect-error -- the status is required
      { user: 'U' },
      // @ts-expect-error -- the user is required
      { requestStatus: ['D'] },
      // @ts-expect-error -- a status letter SAP does not read
      { user: 'U', requestStatus: ['X'] },
      // @ts-expect-error -- a type letter SAP does not read
      { user: 'U', requestStatus: ['D'], requestType: ['k'] },
      // @ts-expect-error -- one form or the other, not both
      { configUri: '/c', user: 'U', requestStatus: ['D'] },
    ];
    const accepted: ListTransportsParams[] = [
      { configUri: '/c' },
      { user: 'U', requestStatus: ['D'] },
      { user: 'U', requestStatus: ['D'], requestType: ['K'], targets: true },
    ];
    expect(refused).toHaveLength(7);
    expect(accepted).toHaveLength(3);
  });
});
