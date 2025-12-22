/**
 * TableType check operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Build check run XML payload
 * @param tableTypeName - Table type name
 * @param sourceCode - Optional DDL source code to validate (will be base64 encoded in artifacts)
 * @param version - Version to check ('active', 'inactive', or 'new')
 */
function buildCheckRunPayload(
  tableTypeName: string,
  sourceCode?: string,
  version: string = 'new',
): string {
  const uriName = encodeSapObjectName(tableTypeName).toLowerCase();
  const objectUri = `/sap/bc/adt/ddic/tabletypes/${uriName}`;

  if (sourceCode) {
    // Check with source code content (for unsaved changes or new code validation)
    const base64Source = Buffer.from(sourceCode, 'utf-8').toString('base64');
    return `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${objectUri}/source/main">
        <chkrun:content>${base64Source}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
  }

  // Check saved version (without source code)
  return `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}"/>
  </chkrun:checkObjectList>`;
}

/**
 * Run check run for table type
 * Note: This is a table type-specific check function. For generic check, use runCheckRun from shared/checkRun
 *
 * @param connection - ABAP connection
 * @param reporter - Check reporter type
 * @param tableTypeName - Table type name to check
 * @param sourceCode - Optional DDL source code to validate (for checking unsaved/new code)
 * @param version - Version to check ('active', 'inactive', or 'new'). Default: 'new'
 * @returns Check result with errors/warnings
 */
export async function runTableTypeCheckRun(
  connection: IAbapConnection,
  reporter: 'tableStatusCheck' | 'abapCheckRun',
  tableTypeName: string,
  sourceCode?: string,
  version: string = 'new',
): Promise<AxiosResponse> {
  const payload = buildCheckRunPayload(tableTypeName, sourceCode, version);
  const headers = {
    Accept: 'application/vnd.sap.adt.checkmessages+xml',
    'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
  };
  const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: payload,
    headers,
  });
}
