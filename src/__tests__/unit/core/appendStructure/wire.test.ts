import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { getAppendStructureSource } from '../../../../core/appendStructure/read';
import { unlockAppendStructure } from '../../../../core/appendStructure/unlock';
import { updateAppendStructure } from '../../../../core/appendStructure/update';

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

describe('appendStructure wire', () => {
  it('update PUTs source/main with encoded lockHandle + corrNr, text/plain, Accept text/plain', async () => {
    const { c, conn } = cap();
    await updateAppendStructure(
      conn,
      {
        append_structure_name: 'ZOK_S_APPEND',
        source_code: 'extend type ...',
        transport_request: 'TRLK9 1',
      },
      'LH/1',
    );
    expect(c.method).toBe('PUT');
    expect(c.url).toBe(
      '/sap/bc/adt/ddic/structures/zok_s_append/source/main?lockHandle=LH%2F1&corrNr=TRLK9%201',
    );
    expect(c.headers?.['Content-Type']).toBe('text/plain; charset=utf-8');
    expect(c.headers?.Accept).toBe('text/plain'); // from trace, NOT structure/update.ts's xml accept
  });

  it('read source GETs source/main with version and Accept text/plain', async () => {
    const { c, conn } = cap();
    await getAppendStructureSource(conn, 'ZOK_S_APPEND', 'active');
    expect(c.url).toBe(
      '/sap/bc/adt/ddic/structures/zok_s_append/source/main?version=active',
    );
    expect(c.headers?.Accept).toBe('text/plain');
  });

  it('unlock POSTs _action=UNLOCK with encoded lockHandle', async () => {
    const { c, conn } = cap();
    await unlockAppendStructure(conn, 'ZOK_S_APPEND', 'LH/1');
    expect(c.url).toBe(
      '/sap/bc/adt/ddic/structures/zok_s_append?_action=UNLOCK&lockHandle=LH%2F1',
    );
  });
});
