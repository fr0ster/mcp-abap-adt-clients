/**
 * Package check operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';

/**
 * Check package for errors
 */
export async function checkPackage(
  connection: AbapConnection,
  packageName: string,
  version: 'active' | 'inactive' = 'active'
): Promise<void> {
  const url = `/sap/bc/adt/checkruns`;

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">

  <chkrun:checkObject adtcore:uri="/sap/bc/adt/packages/${packageName.toLowerCase()}" chkrun:version="${version}"/>

</chkrun:checkObjectList>`;

  await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      'Accept': 'application/vnd.sap.adt.checkmessages+xml',
      'Content-Type': 'application/vnd.sap.adt.checkobjects+xml'
    }
  });
}

