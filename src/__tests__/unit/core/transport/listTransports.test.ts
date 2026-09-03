/**
 * The low level requests; it does not resolve.
 *
 * `listTransports` had five filter parameters the server never read, so the call
 * returned a 309-byte empty root for two weeks while 15 requests sat on the
 * system. These fix the two halves of the replacement: one request, always, to
 * the configUri form — and a configurations reader that never guesses a shape.
 */
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  getTransportSearchConfigurations,
  listTransports,
  parseSearchConfigurations,
} from '../../../../core/transport/list';

const CONFIGURATIONS_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<configurations:configurations xmlns:configurations="http://www.sap.com/adt/configurations">' +
  '<configuration:configuration createdBy="CB9980008038" createdAt="2026-08-07T09:50:48Z" ' +
  'changedBy="CB9980008038" changedAt="2026-08-07T09:50:48Z" client="100" ' +
  'xmlns:configuration="http://www.sap.com/adt/configuration">' +
  '<atom:link href="/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B" ' +
  'rel="http://www.sap.com/adt/categories/configurations" ' +
  'type="application/vnd.sap.adt.configuration.v1+xml" etag="20260807095048" ' +
  'xmlns:atom="http://www.w3.org/2005/Atom"/>' +
  '</configuration:configuration>' +
  '</configurations:configurations>';

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

describe('parseSearchConfigurations reads the href off the link, not the element', () => {
  it('reads uri, etag and the element attributes verbatim', () => {
    const configurations = parseSearchConfigurations(CONFIGURATIONS_XML);

    expect(configurations).toEqual([
      {
        uri: '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B',
        etag: '20260807095048',
        attributes: {
          createdBy: 'CB9980008038',
          createdAt: '2026-08-07T09:50:48Z',
          changedBy: 'CB9980008038',
          changedAt: '2026-08-07T09:50:48Z',
          client: '100',
        },
      },
    ]);
  });

  it('returns none for a system with no saved configuration', () => {
    expect(
      parseSearchConfigurations(
        '<configurations:configurations xmlns:configurations="c"/>',
      ),
    ).toEqual([]);
  });

  it('returns none for an empty body rather than throwing', () => {
    expect(parseSearchConfigurations('')).toEqual([]);
    expect(parseSearchConfigurations(undefined)).toEqual([]);
  });

  it('drops a configuration with no href, since it cannot be addressed', () => {
    const xml =
      '<configurations:configurations xmlns:configurations="c">' +
      '<configuration:configuration client="100" xmlns:configuration="k"/>' +
      '</configurations:configurations>';

    expect(parseSearchConfigurations(xml)).toEqual([]);
  });
});

describe('getTransportSearchConfigurations', () => {
  it('asks the configurations endpoint with its own content type', async () => {
    const { connection, calls } = recordingConnection(CONFIGURATIONS_XML);

    const configurations = await getTransportSearchConfigurations(connection);

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations',
    );
    expect(calls[0].headers?.Accept).toBe(
      'application/vnd.sap.adt.configurations.v1+xml',
    );
    expect(configurations).toHaveLength(1);
  });
});
