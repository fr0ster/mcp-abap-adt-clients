/**
 * FunctionModule check operations
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
import type { IAdtContentTypes } from '../shared/contentTypes';

/**
 * Build check run XML payload for function module
 */
function buildCheckRunXml(
  functionGroupName: string,
  functionModuleName: string,
  version: string,
  sourceCode?: string,
  sourceContentType?: string,
): string {
  const encodedGroup = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModule = encodeSapObjectName(functionModuleName).toLowerCase();
  const objectUri = `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedModule}`;

  if (sourceCode) {
    // TODO: analyze whether chkrun:contentType can be extracted to a constant
    const base64Source = Buffer.from(sourceCode, 'utf-8').toString('base64');
    return `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="${sourceContentType || 'text/plain; charset=utf-8'}" chkrun:uri="${objectUri}/source/main">
        <chkrun:content>${base64Source}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;
  }

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
 * @param sourceCode - Optional source code to validate
 * @returns Check result with errors/warnings
 */
export async function checkFunctionModule(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  version: 'active' | 'inactive',
  sourceCode?: string,
  contentTypes?: IAdtContentTypes,
): Promise<AxiosResponse> {
  const xmlBody = buildCheckRunXml(
    functionGroupName,
    functionModuleName,
    version,
    sourceCode,
    contentTypes?.sourceArtifactContentType(),
  );
  const headers = {
    Accept: ACCEPT_CHECK_MESSAGES,
    'Content-Type': CT_CHECK_OBJECTS,
  };
  const url = `/sap/bc/adt/checkruns?reporters=abapCheckRun`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });

  const checkResult = parseCheckRunResponse(response);

  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Function module check failed: ${errorMessages}`);
  }

  if (checkResult.warnings.length > 0) {
    throw new Error(
      `Function module check failed: ${checkResult.message || 'Warnings found'}`,
    );
  }

  // If status is 'notProcessed', it's an error
  if (checkResult.status === 'notProcessed') {
    throw new Error(
      `Function module check failed: ${checkResult.message || 'Object could not be processed'}`,
    );
  }

  return response;
}
