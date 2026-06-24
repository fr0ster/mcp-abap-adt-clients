import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import {
  checkDeletion,
  deleteScalarFunctionImplementation,
} from '../../../../core/scalarFunctionImplementation/delete';

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

describe('scalarFunctionImplementation delete', () => {
  it('checkDeletion uses the lower-cased dsfi URI', async () => {
    const { calls, conn } = capConn();
    await checkDeletion(conn, { implementation_name: 'ZOK_IMPL' });
    expect(calls[0].data).toContain(
      'adtcore:uri="/sap/bc/adt/ddic/dsfi/zok_impl"',
    );
  });

  it('delete uses the lower-cased dsfi URI', async () => {
    const { calls, conn } = capConn();
    await deleteScalarFunctionImplementation(conn, {
      implementation_name: 'ZOK_IMPL',
    });
    expect(calls[0].data).toContain(
      'adtcore:uri="/sap/bc/adt/ddic/dsfi/zok_impl"',
    );
  });
});
