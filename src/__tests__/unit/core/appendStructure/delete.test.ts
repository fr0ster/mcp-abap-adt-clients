import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import {
  checkDeletion,
  deleteAppendStructure,
} from '../../../../core/appendStructure/delete';

function capConn() {
  const calls: Array<{ data?: string }> = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      calls.push({ data: r.data });
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
      } as IAdtResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { calls, conn };
}

describe('appendStructure delete', () => {
  it('checkDeletion uses the lower-cased structures URI', async () => {
    const { calls, conn } = capConn();
    await checkDeletion(conn, { append_structure_name: 'ZOK_S_APPEND' });
    expect(calls[0].data).toContain(
      'adtcore:uri="/sap/bc/adt/ddic/structures/zok_s_append"',
    );
  });

  it('delete uses the lower-cased structures URI', async () => {
    const { calls, conn } = capConn();
    await deleteAppendStructure(conn, {
      append_structure_name: 'ZOK_S_APPEND',
    });
    expect(calls[0].data).toContain(
      'adtcore:uri="/sap/bc/adt/ddic/structures/zok_s_append"',
    );
  });
});
