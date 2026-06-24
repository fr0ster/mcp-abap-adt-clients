import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { getScalarFunctionImplementationSource } from '../../../../core/scalarFunctionImplementation/read';
import { unlockScalarFunctionImplementation } from '../../../../core/scalarFunctionImplementation/unlock';
import { updateScalarFunctionImplementation } from '../../../../core/scalarFunctionImplementation/update';

function cap() {
  const c: { url?: string; method?: string; headers?: Record<string, string> } =
    {};
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      c.url = r.url;
      c.method = r.method;
      c.headers = r.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
      } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { c, conn };
}

describe('scalarFunctionImplementation wire', () => {
  it('update PUTs object URI with encoded lockHandle+corrNr, blues v2 Content-Type', async () => {
    const { c, conn } = cap();
    await updateScalarFunctionImplementation(
      conn,
      {
        implementation_name: 'ZOK_IMPL',
        source_code: 'x',
        transport_request: 'TRLK9 1',
      },
      'LH/1',
    );
    expect(c.method).toBe('PUT');
    expect(c.url).toBe(
      '/sap/bc/adt/ddic/dsfi/zok_impl?lockHandle=LH%2F1&corrNr=TRLK9%201',
    );
    expect(c.headers?.['Content-Type']).toBe(
      'application/vnd.sap.adt.blues.v2+xml; charset=utf-8',
    );
  });

  it('read source GETs object URI with version + Accept blues v2', async () => {
    const { c, conn } = cap();
    await getScalarFunctionImplementationSource(conn, 'ZOK_IMPL', 'inactive');
    expect(c.url).toBe('/sap/bc/adt/ddic/dsfi/zok_impl?version=inactive');
    expect(c.headers?.Accept).toBe(
      'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.blues.v2+xml',
    );
  });

  it('unlock POSTs _action=UNLOCK with encoded lockHandle', async () => {
    const { c, conn } = cap();
    await unlockScalarFunctionImplementation(conn, 'ZOK_IMPL', 'LH/1');
    expect(c.url).toBe(
      '/sap/bc/adt/ddic/dsfi/zok_impl?_action=UNLOCK&lockHandle=LH%2F1',
    );
  });
});
