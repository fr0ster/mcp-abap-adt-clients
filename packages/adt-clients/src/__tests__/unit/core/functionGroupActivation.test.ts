/**
 * The function group's activation names the group and then its main program
 * (`FUGR/I SAPL<group>`, the group's `source/main`), in one request. Measured
 * 2026-10-29: in a transportable package the group alone leaves both inactive.
 */
import { AdtClientOnPrem } from '../../../clients/AdtClientVariants';
import { RecordingConnection } from '../../helpers/recordingConnection';
import { createLibraryLogger } from '../../helpers/testLogger';

describe('AdtFunctionGroup.activate', () => {
  it('sends both references, the group first, in one request', async () => {
    const connection = new RecordingConnection();
    const sent = connection.sent;
    const client = new AdtClientOnPrem(connection, createLibraryLogger());

    await client.getFunctionGroup().activate(
      { functionGroupName: 'ZFG_ACT' },
      {
        headers: {
          accept: 'application/xml',
          contentType: 'application/xml',
        },
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
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/functions/groups/zfg_act/source/main" adtcore:type="FUGR/I" adtcore:name="SAPLZFG_ACT"/>
</adtcore:objectReferences>`);
  });
});
