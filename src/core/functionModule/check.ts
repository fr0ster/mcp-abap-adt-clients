/**
 * FunctionModule check operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { parseCheckRunResponse } from '../shared/checkRun';

/**
 * Build check run XML payload for function module
 */
function buildCheckRunXml(functionGroupName: string, functionModuleName: string, version: string): string {
  const encodedGroup = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModule = encodeSapObjectName(functionModuleName).toLowerCase();
  const objectUri = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedModule}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;
}

/**
 * Check function module syntax
 */
export async function checkFunctionModule(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  version: string = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const xmlBody = buildCheckRunXml(functionGroupName, functionModuleName, version);
  const headers = {
    'Accept': 'application/vnd.sap.adt.checkmessages+xml',
    'Content-Type': 'application/vnd.sap.adt.checkobjects+xml'
  };
  const url = `/sap/bc/adt/checkruns?reporters=abapCheckRun`;

  let response: AxiosResponse;
  if (sessionId) {
    const { makeAdtRequestWithSession } = await import('../../utils/sessionUtils');
    response = await makeAdtRequestWithSession(connection, url, 'POST', sessionId, xmlBody, headers);
  } else {
    const baseUrl = await connection.getBaseUrl();
    response = await connection.makeAdtRequest({
      url: `${baseUrl}${url}`,
      method: 'POST',
      timeout: getTimeout('default'),
      data: xmlBody,
      headers
    });
  }

  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Function module check failed: ${checkResult.message}`);
  }

  return response;
}

