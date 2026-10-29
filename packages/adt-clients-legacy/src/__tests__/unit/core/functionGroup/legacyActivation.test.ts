/**
 * On 7.40 the function group's activation still names the group alone: the
 * main program as a second reference is measured on S/4HANA 2025 and ABAP
 * cloud, not on 7.40.
 */

import { functionGroupDocuments } from '@mcp-abap-adt/adt-clients';
import { RecordingConnection } from '../../../../../../adt-clients/src/__tests__/helpers/recordingConnection';
import { createLibraryLogger } from '../../../../../../adt-clients/src/__tests__/helpers/testLogger';
import { AdtFunctionGroupLegacy } from '../../../../core/functionGroup/AdtFunctionGroupLegacy';

describe('AdtFunctionGroupLegacy.activate', () => {
  it('sends the group alone, in one request', async () => {
    const conn = new RecordingConnection();
    const sent = conn.sent;

    await new AdtFunctionGroupLegacy(
      conn,
      createLibraryLogger(),
      undefined,
      undefined,
      undefined,
      functionGroupDocuments,
    ).activate(
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
