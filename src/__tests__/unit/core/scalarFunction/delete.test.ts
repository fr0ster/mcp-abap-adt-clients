import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import {
  checkDeletion,
  deleteScalarFunction,
} from '../../../../core/scalarFunction/delete';

function capConn() {
  const calls: Array<{ url: string; data?: string }> = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtResponse> => {
      calls.push({ url: r.url, data: r.data });
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

describe('scalarFunction delete', () => {
  it('checkDeletion uses the lower-cased object URI', async () => {
    const { calls, conn } = capConn();
    await checkDeletion(conn, { scalar_function_name: 'ZOK_TEST_FUNC' });
    expect(calls[0].data).toContain(
      'adtcore:uri="/sap/bc/adt/ddic/dsfd/sources/zok_test_func"',
    );
  });

  it('delete uses the lower-cased object URI', async () => {
    const { calls, conn } = capConn();
    await deleteScalarFunction(conn, { scalar_function_name: 'ZOK_TEST_FUNC' });
    expect(calls[0].data).toContain(
      'adtcore:uri="/sap/bc/adt/ddic/dsfd/sources/zok_test_func"',
    );
  });
});
