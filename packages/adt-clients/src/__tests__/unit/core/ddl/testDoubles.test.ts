/**
 * Whether a CDS view can be tested with doubles is a question about the view,
 * so it is the view's handler that asks it — one POST.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtDdl } from '../../../../core/ddl/AdtDdl';
import { createLibraryLogger } from '../../../helpers/testLogger';

type Call = { url: string; method: string };

function makeConn() {
  const calls: Call[] = [];
  const conn = {
    connect: async () => {},
    getBaseUrl: async () => 'https://example',
    getSessionId: () => null,
    makeAdtRequest: async (call: Call) => {
      calls.push(call);
      return {
        status: 200,
        statusText: 'OK',
        headers: {},
        data: '<SEVERITY>OK</SEVERITY>',
      } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('AdtDdl.checkCdsTestDoubles', () => {
  it('one POST to the test-doubles validation, naming the view', async () => {
    const { conn, calls } = makeConn();

    await new AdtDdl(conn, createLibraryLogger()).checkCdsTestDoubles(
      'ZI_VIEW',
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe(
      '/sap/bc/adt/aunit/dbtestdoubles/cds/validation?ddlName=ZI_VIEW',
    );
  });
});
