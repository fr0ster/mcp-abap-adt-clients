import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { create } from '../../../../core/scalarFunctionImplementation/create';

function mockConn(cap: {
  url?: string;
  data?: string;
  headers?: Record<string, string>;
}) {
  return {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      cap.url = r.url;
      cap.data = r.data;
      cap.headers = r.headers;
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

describe('scalarFunctionImplementation create', () => {
  it('POSTs blues v2 envelope with DSFI/SFI type + base64 server-driven content (sqlEngine default)', async () => {
    const cap: {
      url?: string;
      data?: string;
      headers?: Record<string, string>;
    } = {};
    await create(mockConn(cap), {
      implementation_name: 'zok_test_func_sql',
      scalar_function_name: 'zok_test_func',
      package_name: 'zok_test',
      description: 'SF SQL Impl',
      masterSystem: 'TRL',
      responsible: 'CB9980008038',
    });
    expect(cap.url).toBe('/sap/bc/adt/ddic/dsfi');
    expect(cap.headers?.['Content-Type']).toBe(
      'application/vnd.sap.adt.blues.v2+xml',
    );
    expect(cap.data).toContain('adtcore:type="DSFI/SFI"');
    expect(cap.data).toContain('adtcore:name="ZOK_TEST_FUNC_SQL"');
    expect(cap.data).toContain('<adtcore:packageRef adtcore:name="ZOK_TEST"/>');
    expect(cap.data).toContain(
      '<adtcore:content adtcore:encoding="base64" adtcore:type="application/vnd.sap.adt.serverdriven.content.v1+json">',
    );
    // decode the base64 content
    const m = cap.data?.match(/serverdriven\.content\.v1\+json">([^<]+)</);
    const json = Buffer.from(m![1], 'base64').toString('utf-8');
    expect(json).toBe(
      '{"scalarFunctionName":"ZOK_TEST_FUNC","engineValue":"sqlEngine"}',
    );
  });

  it('honors engine_value=amdpEngine and encodes corrNr', async () => {
    const cap: { url?: string; data?: string } = {};
    await create(mockConn(cap as any), {
      implementation_name: 'zi',
      scalar_function_name: 'zf',
      package_name: 'zp',
      description: 'd',
      engine_value: 'amdpEngine',
      transport_request: 'TRLK9 1',
    });
    expect(cap.url).toBe('/sap/bc/adt/ddic/dsfi?corrNr=TRLK9%201');
    const m = cap.data?.match(/serverdriven\.content\.v1\+json">([^<]+)</);
    expect(Buffer.from(m![1], 'base64').toString('utf-8')).toBe(
      '{"scalarFunctionName":"ZF","engineValue":"amdpEngine"}',
    );
  });
});
