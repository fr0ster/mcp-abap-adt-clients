/**
 * On 7.40 the function group's activation still names the group alone: the
 * main program as a second reference is measured on S/4HANA 2025 and ABAP
 * cloud, not on 7.40.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { createLibraryLogger } from '../../../../../../adt-clients/src/__tests__/helpers/testLogger';
import { AdtFunctionGroupLegacy } from '../../../../core/functionGroup/AdtFunctionGroupLegacy';

interface ISent {
  url: string;
  method: string;
  data: unknown;
}

describe('AdtFunctionGroupLegacy.activate', () => {
  it('sends the group alone, in one request', async () => {
    const sent: ISent[] = [];
    const conn = {
      makeAdtRequest: async (request: ISent) => {
        sent.push(request);
        return {
          status: 200,
          statusText: 'OK',
          headers: {},
          data: '',
        } as IAdtWireResponse;
      },
    } as unknown as IAbapConnection;

    await new AdtFunctionGroupLegacy(conn, createLibraryLogger()).activate(
      { functionGroupName: 'ZFG_ACT' },
      {
        headers: { accept: 'application/xml', contentType: 'application/xml' },
      },
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]?.method).toBe('POST');
    expect(sent[0]?.url).toBe(
      '/sap/bc/adt/activation?method=activate&preauditRequested=true',
    );
    expect(sent[0]?.data).toBe(`<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/functions/groups/zfg_act" adtcore:name="ZFG_ACT"/>
</adtcore:objectReferences>`);
  });
});
