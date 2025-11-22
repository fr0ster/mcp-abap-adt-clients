/**
 * Shared check run utilities
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Get ADT URI for object type
 */
export function getObjectUri(objectType: string, objectName: string): string {
  const encodedName = encodeSapObjectName(objectName.toLowerCase());

  switch (objectType.toLowerCase()) {
    case 'class':
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case 'program':
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case 'interface':
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case 'function_group':
    case 'fugr':
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case 'function_module':
    case 'fugr/ff':
      // Function module needs function group in format: "FUGR_NAME/FM_NAME"
      if (!objectName.includes('/')) {
        throw new Error('Function module requires function group. Use format: "functionGroupName/functionModuleName"');
      }
      const [fugrName, fmName] = objectName.split('/');
      const encodedFugr = encodeSapObjectName(fugrName.toLowerCase());
      const encodedFm = encodeSapObjectName(fmName.toLowerCase());
      return `/sap/bc/adt/functions/groups/${encodedFugr}/fmodules/${encodedFm}`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
    case 'domain':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'data_element':
    case 'dtel':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    case 'package':
    case 'devc/k':
      return `/sap/bc/adt/packages/${encodedName}`;
    default:
      throw new Error(`Unsupported object type: ${objectType}`);
  }
}

/**
 * Build check run XML payload
 */
/**
 * Build XML body for checkRun request (checks code already in SAP system)
 *
 * Format: Simple URI + version
 * - version="inactive": Checks saved but not activated code
 * - version="active": Checks activated code
 *
 * SAP reads the code from system itself.
 */
export function buildCheckRunXml(objectUri: string, version: string = 'active'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;
}

/**
 * Build XML body for checkRun request with source code (live validation)
 *
 * Used for checking code that hasn't been saved to SAP yet.
 * SAP will validate the provided source code instead of reading from system.
 *
 * @param objectUri - ADT URI of the object (e.g., /sap/bc/adt/oo/classes/zcl_test)
 * @param sourceCode - Source code to validate
 * @param version - 'active' or 'inactive' (typically 'active' for live validation)
 */
export function buildCheckRunXmlWithSource(
  objectUri: string,
  sourceCode: string,
  version: string = 'active'
): string {
  // Encode source code to base64
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

/**
 * Parse check run response
 */
export function parseCheckRunResponse(response: AxiosResponse): {
  success: boolean;
  status: string;
  message: string;
  errors: any[];
  warnings: any[];
  info: any[];
  total_messages: number;
  has_errors: boolean;
  has_warnings: boolean;
} {
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
      return {
        success: true,
        status: 'no_report',
        message: 'No check report in response (possibly no issues found)',
        errors: [],
        warnings: [],
        info: [],
        total_messages: 0,
        has_errors: false,
        has_warnings: false
      };
    }

    const status = checkReport['@_chkrun:status'] || checkReport['chkrun:status'] || checkReport['@_status'] || checkReport['status'];
    const statusText = checkReport['chkrun:statusText'] || checkReport['@_chkrun:statusText'] || checkReport['statusText'] || checkReport['@_statusText'] || '';

    const messages = checkReport['chkrun:checkMessageList']?.['chkrun:checkMessage']
      || checkReport['checkMessageList']?.['checkMessage']
      || checkReport['chkrun:messages']?.['msg']
      || checkReport['messages']?.['msg']
      || checkReport['chkrun:messages']
      || checkReport['messages']
      || [];

    const messageArray = Array.isArray(messages) ? messages : (messages ? [messages] : []);

    const errors: any[] = [];
    const warnings: any[] = [];
    const info: any[] = [];

    messageArray.forEach((msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      const msgType = msg['@_chkrun:type'] || msg['@_type'] || msg['type'];
      const shortText = msg['@_chkrun:shortText'] || msg['shortText']?.['#text'] || msg['shortText'] || msg['shortText']?.['txt'] || '';
      const line = msg['@_line'] || msg['line'];
      const href = msg['@_chkrun:uri'] || msg['@_href'] || msg['href'];

      const msgObj = {
        type: msgType,
        text: shortText,
        line: line || '',
        href: href || ''
      };

      if (msgType === 'E') {
        errors.push(msgObj);
      } else if (msgType === 'W') {
        warnings.push(msgObj);
      } else {
        info.push(msgObj);
      }
    });

    // If status is 'notProcessed', it's an error (object doesn't exist or can't be validated)
    const hasErrors = errors.length > 0 || status === 'notProcessed';
    const isSuccess = status === 'processed' && errors.length === 0;

    return {
      success: isSuccess,
      status: status || 'no_report',
      message: statusText,
      errors,
      warnings,
      info,
      total_messages: messageArray.length,
      has_errors: hasErrors,
      has_warnings: warnings.length > 0
    };
  } catch (error) {
    return {
      success: false,
      status: 'parse_error',
      message: `Failed to parse check run response: ${error}`,
      errors: [],
      warnings: [],
      info: [],
      total_messages: 0,
      has_errors: false,
      has_warnings: false
    };
  }
}

/**
 * Run check run for any object type
 */
export async function runCheckRun(
  connection: AbapConnection,
  objectType: string,
  objectName: string,
  version: string = 'active',
  reporter: string = 'abapCheckRun',
  sessionId?: string,
  sourceCode?: string
): Promise<AxiosResponse> {
  const objectUri = getObjectUri(objectType, objectName);
  const xmlBody = sourceCode 
    ? buildCheckRunXmlWithSource(objectUri, sourceCode, version)
    : buildCheckRunXml(objectUri, version);

  const headers = {
    'Accept': 'application/vnd.sap.adt.checkmessages+xml',
    'Content-Type': 'application/vnd.sap.adt.checkobjects+xml'
  };

  const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;

  if (sessionId) {
    const { makeAdtRequestWithSession } = await import('../../utils/sessionUtils');
    return makeAdtRequestWithSession(connection, url, 'POST', sessionId, xmlBody, headers);
  } else {
    const baseUrl = await connection.getBaseUrl();
    return connection.makeAdtRequest({
      url: `${baseUrl}${url}`,
      method: 'POST',
      timeout: (await import('@mcp-abap-adt/connection')).getTimeout('default'),
      data: xmlBody,
      headers
    });
  }
}

/**
 * Run a check on an object with unsaved source code (live validation).
 *
 * This function validates source code that hasn't been saved to SAP yet,
 * similar to real-time validation in Eclipse ADT editor during typing.
 *
 * @param connection - The ABAP connection
 * @param objectType - Type of object (e.g., 'class', 'program')
 * @param objectName - Name of the object
 * @param sourceCode - The source code to validate
 * @param version - Version to validate against ('active' or 'inactive')
 * @param reporter - Reporter type for check results
 * @param sessionId - Optional session ID for session-based requests
 * @returns Promise resolving to AxiosResponse with check results
 */
export async function runCheckRunWithSource(
  connection: AbapConnection,
  objectType: string,
  objectName: string,
  sourceCode: string,
  version: string = 'active',
  reporter: string = 'abapCheckRun',
  sessionId?: string
): Promise<AxiosResponse> {
  const objectUri = await getObjectUri(objectType, objectName);
  const xmlBody = buildCheckRunXmlWithSource(objectUri, sourceCode, version);

  const headers = {
    'Content-Type': 'application/vnd.sap.adt.checkobjects+xml'
  };

  const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;

  if (sessionId) {
    const { makeAdtRequestWithSession } = await import('../../utils/sessionUtils');
    return makeAdtRequestWithSession(connection, url, 'POST', sessionId, xmlBody, headers);
  } else {
    const baseUrl = await connection.getBaseUrl();
    return connection.makeAdtRequest({
      url: `${baseUrl}${url}`,
      method: 'POST',
      timeout: (await import('@mcp-abap-adt/connection')).getTimeout('default'),
      data: xmlBody,
      headers
    });
  }
}

