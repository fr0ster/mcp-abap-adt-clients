/**
 * FunctionInclude (FUGR/I) check operations.
 *
 * Uses /sap/bc/adt/checkruns?reporters=abapCheckRun. When sourceCode is
 * supplied, the unsaved source is attached as a base64 artifact; otherwise
 * the server re-reads the persisted version by URI.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_CHECK_MESSAGES,
  CT_CHECK_OBJECTS,
} from '../../constants/contentTypes';
import { parseCheckRunResponse } from '../../utils/checkRun';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Check function include via /sap/bc/adt/checkruns?reporters=abapCheckRun.
 */
export async function checkFunctionInclude(
  connection: IAbapConnection,
  groupName: string,
  includeName: string,
  version: 'active' | 'inactive',
  xmlContent?: string,
  sourceContentType?: string,
): Promise<AxiosResponse> {
  if (!groupName) {
    throw new Error('Function group name is required');
  }
  if (!includeName) {
    throw new Error('Include name is required');
  }

  const groupLower = encodeSapObjectName(groupName).toLowerCase();
  const encodedInclude = encodeSapObjectName(includeName.toUpperCase());
  const objectUri = `/sap/bc/adt/functions/groups/${groupLower}/includes/${encodedInclude}`;

  let xmlBody: string;
  if (xmlContent) {
    const base64Content = Buffer.from(xmlContent, 'utf-8').toString('base64');
    const artifactContentType =
      sourceContentType || 'text/plain; charset=utf-8';
    xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="${artifactContentType}" chkrun:uri="${objectUri}/source/main">
        <chkrun:content>${base64Content}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
  } else {
    xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;
  }

  const response = await connection.makeAdtRequest({
    url: '/sap/bc/adt/checkruns?reporters=abapCheckRun',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: ACCEPT_CHECK_MESSAGES,
      'Content-Type': CT_CHECK_OBJECTS,
    },
  });

  const checkResult = parseCheckRunResponse(response);
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Function include check failed: ${errorMessages}`);
  }

  return response;
}
