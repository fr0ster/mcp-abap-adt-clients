/**
 * Enhancement check operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { requestHeaders } from '../../utils/requestHeaders';
import {
  type EnhancementType,
  getEnhancementUri,
  type ICheckEnhancementParams,
  supportsSourceCode,
} from './types';

/**
 * Check enhancement syntax/consistency
 *
 * @param connection - SAP connection
 * @param params - Check parameters
 * @returns Axios response with check result
 */
export async function checkEnhancement(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: ICheckEnhancementParams,
): Promise<IAdtWireResponse> {
  const {
    enhancement_name,
    enhancement_type,
    version = 'inactive',
    source_code,
  } = params;

  const objectUri = getEnhancementUri(enhancement_type, enhancement_name);
  const versionParam = version === 'inactive' ? 'workingArea' : 'active';

  // The document every other handler's check sends (`buildCheckRunXml`), with
  // the reporter in the query. Until 36.0.1 this sent a
  // `chkrun:checkRunRequest` with the reporter inside it, the type of the
  // recorded pair `application/vnd.sap.adt.checkrun.v1+xml`. SAP refuses that
  // pair `415` ("Supported Media Types: application/vnd.sap.adt.checkobjects+xml")
  // and answers `400` "System expected the element
  // '{http://www.sap.com/adt/checkrun}checkObjectList'" to the document under
  // the checkobjects type. With this document and the checkmessages /
  // checkobjects pair it answers `200` (`workingArea` and `active` both
  // processed), with the source too. Measured on an on-premise system,
  // 2026-10-19.
  const checkUrl = `/sap/bc/adt/checkruns?reporters=abapCheckRun`;

  let artifactsXml = '';
  if (source_code && supportsSourceCode(enhancement_type)) {
    // Include source code for live validation (base64 encoded)
    const base64Source = Buffer.from(source_code, 'utf-8').toString('base64');
    artifactsXml = `
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${objectUri}/source/main">
        <chkrun:content>${base64Source}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  `;
  }

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${versionParam}">${artifactsXml}</chkrun:checkObject>
</chkrun:checkObjectList>`;

  return connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: 0,
    data: xmlPayload,
    headers: requestHeaders(headers),
  });
}

/**
 * Convenience function: Check enhancement with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param version - 'active' or 'inactive' (default: 'inactive')
 * @param sourceCode - Optional source code for live validation
 * @returns Axios response
 */
export async function check(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  enhancementType: EnhancementType,
  enhancementName: string,
  version: 'active' | 'inactive' = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  return checkEnhancement(connection, headers, {
    enhancement_name: enhancementName,
    enhancement_type: enhancementType,
    version,
    source_code: sourceCode,
  });
}
