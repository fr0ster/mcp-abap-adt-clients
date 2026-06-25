import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { getScalarFunctionSource } from '../../../../core/scalarFunction/read';
import { unlockScalarFunction } from '../../../../core/scalarFunction/unlock';
import { updateScalarFunction } from '../../../../core/scalarFunction/update';

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

describe('scalarFunction wire', () => {
  it('update PUTs source/main with encoded lockHandle + corrNr and text/plain content-type', async () => {
    const { c, conn } = cap();
    await updateScalarFunction(
      conn,
      {
        scalar_function_name: 'ZOK_TEST_FUNC',
        source_code: 'define scalar function ...',
        transport_request: 'TRLK9 1',
      },
      'LH/1',
    );
    expect(c.method).toBe('PUT');
    expect(c.url).toBe(
      '/sap/bc/adt/ddic/dsfd/sources/zok_test_func/source/main?lockHandle=LH%2F1&corrNr=TRLK9%201',
    );
    expect(c.headers?.['Content-Type']).toBe('text/plain; charset=utf-8');
  });

  it('read source GETs source/main with version and Accept text/plain', async () => {
    const { c, conn } = cap();
    await getScalarFunctionSource(conn, 'ZOK_TEST_FUNC', 'active');
    expect(c.method).toBe('GET');
    expect(c.url).toBe(
      '/sap/bc/adt/ddic/dsfd/sources/zok_test_func/source/main?version=active',
    );
    expect(c.headers?.Accept).toBe('text/plain');
  });

  it('unlock POSTs _action=UNLOCK with encoded lockHandle', async () => {
    const { c, conn } = cap();
    await unlockScalarFunction(conn, 'ZOK_TEST_FUNC', 'LH/1');
    expect(c.url).toBe(
      '/sap/bc/adt/ddic/dsfd/sources/zok_test_func?_action=UNLOCK&lockHandle=LH%2F1',
    );
  });
});
