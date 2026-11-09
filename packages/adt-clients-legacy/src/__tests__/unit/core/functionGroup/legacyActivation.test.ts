/**
 * On 7.40 the function group's activation still names the group alone: the
 * main program as a second reference is measured on S/4HANA 2025 and ABAP
 * cloud, not on 7.40.
 */

import { functionGroupDocuments } from '@mcp-abap-adt/adt-clients';
import {
  CriticalSectionConnection,
  RecordingConnection,
} from '../../../../../../adt-clients/src/__tests__/helpers/recordingConnection';
import { createLibraryLogger } from '../../../../../../adt-clients/src/__tests__/helpers/testLogger';
import { AdtFunctionGroupLegacy } from '../../../../core/functionGroup/AdtFunctionGroupLegacy';

describe('AdtFunctionGroupLegacy.activate', () => {
  it('sends the group alone, in one request', async () => {
    const conn = new RecordingConnection();
    const sent = conn.sent;

    await new AdtFunctionGroupLegacy(conn, {
      logger: createLibraryLogger(),
      results: functionGroupDocuments,
    }).activate(
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

  it.each([
    [false, 'false'],
    [true, 'true'],
  ])(
    'sends preauditRequested=%s when asked',
    async (preauditRequested, sent) => {
      const conn = new RecordingConnection();
      await new AdtFunctionGroupLegacy(conn, {
        logger: createLibraryLogger(),
        results: functionGroupDocuments,
      }).activate(
        { functionGroupName: 'ZFG_ACT' },
        {
          headers: {
            accept: 'application/xml',
            contentType: 'application/xml',
          },
          preauditRequested,
        },
      );
      expect(conn.sent.map((r) => r.url)).toEqual([
        `/sap/bc/adt/activation?method=activate&preauditRequested=${sent}`,
      ]);
    },
  );

  it('reads the inactive list once after a silent checklist, naming the group', async () => {
    const silent =
      '<?xml version="1.0" encoding="utf-8"?><chkl:messages xmlns:chkl="http://www.sap.com/abapxml/checklist"><chkl:properties checkExecuted="false" activationExecuted="false" generationExecuted="false"/></chkl:messages>';
    const conn = new CriticalSectionConnection(() => silent);
    let named: readonly string[] | undefined;
    await new AdtFunctionGroupLegacy(conn, {
      logger: createLibraryLogger(),
      results: functionGroupDocuments,
    }).activate(
      { functionGroupName: 'ZFG_ACT' },
      {
        headers: { accept: 'application/xml', contentType: 'application/xml' },
        analyse: (verdict, _answer, context) => {
          named = context?.activation?.named;
          return verdict;
        },
      },
    );
    expect(conn.events).toEqual([
      'POST /sap/bc/adt/activation?method=activate&preauditRequested=true',
      'GET /sap/bc/adt/activation/inactiveobjects',
    ]);
    expect(named).toEqual(['/sap/bc/adt/functions/groups/zfg_act']);
  });
});
