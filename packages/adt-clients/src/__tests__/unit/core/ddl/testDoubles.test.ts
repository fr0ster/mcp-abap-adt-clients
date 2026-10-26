/**
 * Whether a CDS view can be tested with doubles is a question about the view,
 * so it is the view's handler that asks it — one POST, and none on a legacy
 * system, where the endpoint does not exist.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtDdl } from '../../../../core/ddl/AdtDdl';
import { AdtDdlLegacy } from '../../../../core/ddl/AdtDdlLegacy';
import { expectFailure } from '../../../helpers/contract';
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

  it('a legacy system refuses without a request', async () => {
    const { conn, calls } = makeConn();

    expectFailure(
      await new AdtDdlLegacy(conn, createLibraryLogger()).checkCdsTestDoubles(
        'ZI_VIEW',
      ),
      'no endpoint below 7.50',
    );
    expect(calls).toHaveLength(0);
  });
});
