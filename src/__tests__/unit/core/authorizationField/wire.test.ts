import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { create } from '../../../../core/authorizationField/create';
import { updateAuthorizationField } from '../../../../core/authorizationField/update';
import { buildAuthorizationFieldXml } from '../../../../core/authorizationField/xmlBuilder';

function cap() {
  const c: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
    data?: string;
  } = {};
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      c.url = r.url;
      c.method = r.method;
      c.headers = r.headers;
      c.data = r.data;
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

const PARAMS = {
  authorization_field_name: 'ZAC_AUTH01',
  package_name: 'TEST_MCP',
  description: 'workflow field',
};

describe('authorizationField wire', () => {
  // The endpoint answers a GET with <auth:auth>, and it rejects any other root
  // with HTTP 500 "System expected the element '{http://www.sap.com/iam/auth}auth'".
  it('builds the payload with the auth:auth root the endpoint expects', () => {
    const xml = buildAuthorizationFieldXml(PARAMS);
    expect(xml).toContain('<auth:auth ');
    expect(xml).toContain('</auth:auth>');
    expect(xml).not.toContain('authorizationField');
  });

  it('keeps both namespaces and the adtcore attributes on that root', () => {
    const xml = buildAuthorizationFieldXml({
      ...PARAMS,
      master_system: 'E19',
      responsible: 'OKYSLYTSIA',
    });
    expect(xml).toContain('xmlns:auth="http://www.sap.com/iam/auth"');
    expect(xml).toContain('xmlns:adtcore="http://www.sap.com/adt/core"');
    expect(xml).toContain('adtcore:name="ZAC_AUTH01"');
    expect(xml).toContain('adtcore:type="AUTH"');
    expect(xml).toContain('adtcore:masterSystem="E19"');
    expect(xml).toContain('adtcore:responsible="OKYSLYTSIA"');
    expect(xml).toContain('<adtcore:packageRef adtcore:name="TEST_MCP"/>');
  });

  it('create POSTs that root to the collection URL', async () => {
    const { c, conn } = cap();
    await create(conn, PARAMS);
    expect(c.method).toBe('POST');
    expect(c.url).toBe('/sap/bc/adt/aps/iam/auth');
    expect(c.data).toContain('<auth:auth ');
    expect(c.headers?.['Content-Type']).toBe(
      'application/vnd.sap.adt.blues.v1+xml',
    );
  });

  it('update PUTs that same root with an encoded lockHandle', async () => {
    const { c, conn } = cap();
    await updateAuthorizationField(conn, PARAMS, 'LH/1');
    expect(c.method).toBe('PUT');
    expect(c.url).toBe('/sap/bc/adt/aps/iam/auth/ZAC_AUTH01?lockHandle=LH%2F1');
    expect(c.data).toContain('<auth:auth ');
  });
});
