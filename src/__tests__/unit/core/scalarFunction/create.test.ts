import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { create } from '../../../../core/scalarFunction/create';

function mockConn(capture: {
  url?: string;
  data?: string;
  headers?: Record<string, string>;
}) {
  return {
    makeAdtRequest: async (req: any): Promise<IAdtResponse> => {
      capture.url = req.url;
      capture.data = req.data;
      capture.headers = req.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
      } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

describe('scalarFunction create', () => {
  it('POSTs a blues envelope with DSFD/SCF type, upper-cased name/package, escaped description', async () => {
    const cap: {
      url?: string;
      data?: string;
      headers?: Record<string, string>;
    } = {};
    await create(mockConn(cap), {
      scalar_function_name: 'zok_test_func',
      package_name: 'zok_test',
      description: 'A & B',
      masterSystem: 'TRL',
      responsible: 'CB9980008038',
    });

    expect(cap.url).toBe('/sap/bc/adt/ddic/dsfd/sources');
    expect(cap.headers?.['Content-Type']).toBe(
      'application/vnd.sap.adt.blues.v1+xml',
    );
    expect(cap.data).toContain(
      '<blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue"',
    );
    expect(cap.data).toContain('adtcore:type="DSFD/SCF"');
    expect(cap.data).toContain('adtcore:name="ZOK_TEST_FUNC"');
    expect(cap.data).toContain('adtcore:masterSystem="TRL"');
    expect(cap.data).toContain('adtcore:responsible="CB9980008038"');
    expect(cap.data).toContain('adtcore:description="A &amp; B"');
    expect(cap.data).toContain('<adtcore:packageRef adtcore:name="ZOK_TEST"/>');
  });

  it('appends encoded corrNr when a transport is supplied and omits masterSystem when absent', async () => {
    const cap: { url?: string; data?: string } = {};
    await create(mockConn(cap as any), {
      scalar_function_name: 'zok_f',
      package_name: 'zok_test',
      description: 'd',
      transport_request: 'TRLK9 00001',
    });
    expect(cap.url).toBe('/sap/bc/adt/ddic/dsfd/sources?corrNr=TRLK9%2000001');
    expect(cap.data).not.toContain('masterSystem');
  });
});
