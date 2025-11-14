/**
 * FunctionModule check operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';

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
 * Parse check run response
 */
function parseCheckRunResponse(response: AxiosResponse): { success: boolean; message: string; has_errors: boolean } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  try {
    const result = parser.parse(response.data);
    let checkReport = result['chkrun:checkRunReports']?.['chkrun:checkReport'];

    if (!checkReport) {
      checkReport = result['checkRunReports']?.['checkReport'];
    }

    if (!checkReport) {
      checkReport = result['chkrun:checkReport'];
    }

    if (!checkReport) {
      return { success: true, message: 'No check report (possibly no issues)', has_errors: false };
    }

    const status = checkReport['@_chkrun:status'] || checkReport['chkrun:status'] || checkReport['@_status'] || checkReport['status'];
    const statusText = checkReport['chkrun:statusText'] || checkReport['@_chkrun:statusText'] || checkReport['statusText'] || checkReport['@_statusText'] || '';

    const messages = checkReport['chkrun:messages']?.['msg']
      || checkReport['messages']?.['msg']
      || checkReport['chkrun:messages']
      || checkReport['messages']
      || [];

    const messageArray = Array.isArray(messages) ? messages : (messages ? [messages] : []);
    const hasErrors = messageArray.some((msg: any) => {
      const msgType = msg['@_type'] || msg['type'];
      return msgType === 'E';
    });

    const isSuccess = (status === 'processed' || status === 'no_report') && !hasErrors;

    return {
      success: isSuccess,
      message: statusText,
      has_errors: hasErrors
    };
  } catch (error) {
    return {
      success: false,
      message: `Failed to parse check run response: ${error}`,
      has_errors: true
    };
  }
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

/**
 * Validate function module source code that hasn't been saved to SAP yet (live validation).
 *
 * This performs real-time syntax/ATC checks on unsaved source code,
 * similar to the validation Eclipse ADT editor does during typing.
 * The source code is encoded as base64 and sent as an artifact in the check request.
 *
 * Use cases:
 * - Validate code before saving to SAP
 * - Real-time validation during code editing
 * - Pre-flight checks before create/update operations
 *
 * @param connection - SAP connection
 * @param functionGroupName - Function group name (for context)
 * @param functionModuleName - Function module name (for context, doesn't need to exist in SAP)
 * @param sourceCode - The ABAP source code to validate
 * @param version - 'active' (default) or 'inactive' - version context for validation
 * @param sessionId - Optional session ID
 * @returns Check result with errors/warnings
 * @throws Error if validation finds syntax errors
 */
export async function validateFunctionModuleSource(
  connection: AbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  sourceCode: string,
  version: 'inactive' | 'active' = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const { buildCheckRunXmlWithSource } = await import('../shared/checkRun');

  const encodedGroup = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModule = encodeSapObjectName(functionModuleName).toLowerCase();
  const objectUri = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedModule}`;

  // Build XML with source code embedded
  const xmlBody = buildCheckRunXmlWithSource(objectUri, sourceCode, version);

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
    throw new Error(`Source validation failed: ${checkResult.message}`);
  }

  return response;
}

