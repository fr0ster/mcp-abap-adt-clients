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
 * Check function module code (syntax, compilation, rules)
 *
 * CheckRun validates everything: syntax, compilation errors, warnings, code quality rules.
 *
 * Can check:
 * - Existing active function module: provide functionGroupName, functionModuleName, version='active'
 * - Existing inactive function module: provide functionGroupName, functionModuleName, version='inactive'
 *
 * @param connection - SAP connection
 * @param functionGroupName - Function group name
 * @param functionModuleName - Function module name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 */
export async function checkFunctionModule(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  version: 'active' | 'inactive',
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

  // Check result is OK if:
  // 1. Message says "has been checked" or "was checked" - object was already checked, this is OK
  // Problems are: ERROR and WARNING
  // Only throw error if there are actual ERROR or WARNING messages

  // If message indicates object was already checked, it's OK (even if has errors/warnings)
  const isAlreadyChecked = checkResult.message?.toLowerCase().includes('has been checked') ||
                          checkResult.message?.toLowerCase().includes('was checked');

  if (isAlreadyChecked) {
    return response; // Object was already checked - this is OK
  }

  // Problems: ERROR (errors) and WARNING (warnings)
  if (checkResult.errors.length > 0) {
    throw new Error(`Function module check failed: ${checkResult.message || 'Unknown error'}`);
  }

  if (checkResult.warnings.length > 0) {
    throw new Error(`Function module check failed: ${checkResult.message || 'Warnings found'}`);
  }

  // If status is 'notProcessed', it's an error
  if (checkResult.status === 'notProcessed') {
    throw new Error(`Function module check failed: ${checkResult.message || 'Object could not be processed'}`);
  }

  return response;
}

