/**
 * Table check operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Build check run XML payload
 */
function buildCheckRunPayload(tableName: string): string {
  const uriName = encodeSapObjectName(tableName).toLowerCase();
  return `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="/sap/bc/adt/ddic/tables/${uriName}" chkrun:version="new"/>
  </chkrun:checkObjectList>`;
}

/**
 * Run check run for table
 * Note: This is a table-specific check function. For generic check, use runCheckRun from shared/checkRun
 */
export async function runTableCheckRun(
  connection: IAbapConnection,
  reporter: 'tableStatusCheck' | 'abapCheckRun',
  tableName: string
): Promise<AxiosResponse> {
  const payload = buildCheckRunPayload(tableName);
  const headers = {
    'Accept': 'application/vnd.sap.adt.checkmessages+xml',
    'Content-Type': 'application/vnd.sap.adt.checkobjects+xml'
  };
  const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;
  return connection.makeAdtRequest({ url, method: 'POST', timeout: getTimeout('default'), data: payload, headers });
}

