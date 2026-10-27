/**
 * Whether a CDS view can be tested with doubles is a question about the view;
 * on a legacy system, where the endpoint does not exist, the view's handler
 * asks nothing.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { expectFailure } from '../../../../../../adt-clients/src/__tests__/helpers/contract';
import { createLibraryLogger } from '../../../../../../adt-clients/src/__tests__/helpers/testLogger';
import { AdtDdlLegacy } from '../../../../core/ddl/AdtDdlLegacy';

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
  it('a legacy system refuses without a request', async () => {
    const { conn, calls } = makeConn();

    expectFailure(
      await new AdtDdlLegacy(conn, createLibraryLogger()).checkCdsTestDoubles(
        'ZI_VIEW',
      ),
      'no endpoint on 7.40 SP04',
    );
    expect(calls).toHaveLength(0);
  });
});
