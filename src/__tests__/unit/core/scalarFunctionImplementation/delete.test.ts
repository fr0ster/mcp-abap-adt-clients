import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  checkDeletion,
  deleteScalarFunctionImplementation,
} from '../../../../core/scalarFunctionImplementation/delete';
import { headersFor } from '../../../helpers/adtHeaders';

function capConn() {
  const calls: Array<{ data?: string }> = [];
  const conn = {
    makeAdtRequest: async (r: any): Promise<IAdtWireResponse> => {
      calls.push({ data: r.data });
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '',
      } as IAdtWireResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { calls, conn };
}

describe('scalarFunctionImplementation delete', () => {
  it('checkDeletion uses the lower-cased dsfi URI', async () => {
    const { calls, conn } = capConn();
    await checkDeletion(
      conn,
      headersFor('AdtScalarFunctionImplementation.checkDeletion'),
      { implementation_name: 'ZOK_IMPL' },
    );
    expect(calls[0].data).toContain(
      'adtcore:uri="/sap/bc/adt/ddic/dsfi/zok_impl"',
    );
  });

  it('delete uses the lower-cased dsfi URI', async () => {
    const { calls, conn } = capConn();
    await deleteScalarFunctionImplementation(
      conn,
      headersFor('AdtScalarFunctionImplementation.delete'),
      {
        implementation_name: 'ZOK_IMPL',
      },
    );
    expect(calls[0].data).toContain(
      'adtcore:uri="/sap/bc/adt/ddic/dsfi/zok_impl"',
    );
  });
});
