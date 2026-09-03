import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { create } from '../../../../core/appendStructure/create';

function mockConn(capture: {
  url?: string;
  data?: string;
  headers?: Record<string, string>;
}) {
  return {
    makeAdtRequest: async (req: any): Promise<IAdtWireResponse> => {
      capture.url = req.url;
      capture.data = req.data;
      capture.headers = req.headers;
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
      } as IAdtWireResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

describe('appendStructure create', () => {
  it('POSTs a blues+template envelope (TABL/DS, base_structure), upper-cased identifiers', async () => {
    const cap: {
      url?: string;
      data?: string;
      headers?: Record<string, string>;
    } = {};
    await create(mockConn(cap), {
      append_structure_name: 'zac_s_append',
      base_object: 'zac_shr_appstru',
      package_name: 'zac_shr_pkg',
      description: 'Test',
      masterSystem: 'TRL',
      responsible: 'CB9980008038',
    });
    expect(cap.url).toBe('/sap/bc/adt/ddic/structures');
    expect(cap.headers?.['Content-Type']).toBe(
      'application/vnd.sap.adt.structures.v2+xml',
    );
    expect(cap.data).toContain('adtcore:type="TABL/DS"');
    expect(cap.data).toContain('adtcore:name="ZAC_S_APPEND"');
    expect(cap.data).toContain(
      '<adtcore:adtProperty adtcore:key="base_structure">ZAC_SHR_APPSTRU</adtcore:adtProperty>',
    );
    expect(cap.data).toContain(
      '<adtcore:packageRef adtcore:name="ZAC_SHR_PKG"/>',
    );
  });

  it('works identically for a table base (same base_structure key)', async () => {
    const cap: { data?: string } = {};
    await create(mockConn(cap as any), {
      append_structure_name: 'zac_s_append_t',
      base_object: 'zac_shr_apptabl',
      package_name: 'zac_shr_pkg',
      description: 'Test',
    });
    expect(cap.data).toContain(
      '<adtcore:adtProperty adtcore:key="base_structure">ZAC_SHR_APPTABL</adtcore:adtProperty>',
    );
  });
});
