import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { deleteFunctionInclude } from '../../../core/functionInclude/delete';

function connReturning(xml: string): IAbapConnection {
  const makeAdtRequest = jest.fn(async () => ({ status: 200, data: xml }));
  return { makeAdtRequest } as unknown as IAbapConnection;
}

const OK_XML =
  '<?xml version="1.0" encoding="utf-8"?><del:deletionResult xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core"><del:object del:isDeleted="true" adtcore:type="FUGR/I" adtcore:name="LZG_C01"/></del:deletionResult>';

// Exact success response observed on the system for a real custom FUGR include:
// isDeleted="true" with a type="S" message and an empty <del:text/>.
const OK_XML_WITH_S_MESSAGE =
  '<?xml version="1.0" encoding="UTF-8"?><del:deletionResult xmlns:del="http://www.sap.com/adt/deletion"><del:object xmlns:adtcore="http://www.sap.com/adt/core" del:isDeleted="true" adtcore:uri="/sap/bc/adt/functions/groups/zok_test_fg_01/includes/lzok_test_fg_01zok" adtcore:type="FUGR/I" adtcore:name="LZOK_TEST_FG_01ZOK" adtcore:packageName="ZOK_TEST"><del:message del:priority="0" del:type="S"><del:text/></del:message></del:object></del:deletionResult>';

// Real shape observed on the system: HTTP 200, isDeleted="false", error message
// with a nested longtext atom:link inside del:text.
const REFUSED_XML =
  '<?xml version="1.0" encoding="utf-8"?><del:deletionResult xmlns:del="http://www.sap.com/adt/deletion"><del:object del:isDeleted="false" adtcore:type="FUGR/I" adtcore:name="LZG_T01" xmlns:adtcore="http://www.sap.com/adt/core"><del:message del:priority="0" del:type="E"><del:text>Only delete function module includes using Function Builder</del:text><atom:link href="/x" rel="longtext" type="text/html" xmlns:atom="http://www.w3.org/2005/Atom"/></del:message></del:object></del:deletionResult>';

describe('deleteFunctionInclude', () => {
  it('resolves with a success payload when the server reports isDeleted="true"', async () => {
    const conn = connReturning(OK_XML);
    const res = await deleteFunctionInclude(conn, {
      function_group_name: 'ZG',
      include_name: 'LZG_C01',
    });
    expect((res.data as any).success).toBe(true);
    expect((res.data as any).include_name).toBe('LZG_C01');
  });

  it('resolves on the real success response shape (isDeleted="true" + type="S" empty message)', async () => {
    const conn = connReturning(OK_XML_WITH_S_MESSAGE);
    const res = await deleteFunctionInclude(conn, {
      function_group_name: 'ZOK_TEST_FG_01',
      include_name: 'LZOK_TEST_FG_01ZOK',
    });
    expect((res.data as any).success).toBe(true);
  });

  it('throws the server message when isDeleted="false" (does not mask as success)', async () => {
    const conn = connReturning(REFUSED_XML);
    await expect(
      deleteFunctionInclude(conn, {
        function_group_name: 'ZG',
        include_name: 'LZG_T01',
      }),
    ).rejects.toThrow(
      'Only delete function module includes using Function Builder',
    );
  });

  it('throws (not silent success) on an empty/unparseable body', async () => {
    const conn = connReturning('');
    await expect(
      deleteFunctionInclude(conn, {
        function_group_name: 'ZG',
        include_name: 'LZG_X',
      }),
    ).rejects.toThrow('was not deleted');
  });
});
