/**
 * Domain check operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Check domain syntax
 *
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param xmlContent - Optional XML content to validate (same format as PUT body). If provided, check validates this content instead of saved version.
 * @returns Check result with errors/warnings
 *
 * Note: When xmlContent is provided, it should be the same XML that will be sent in PUT request.
 */
export async function checkDomainSyntax(
  connection: IAbapConnection,
  domainName: string,
  version: 'active' | 'inactive',
  xmlContent?: string,
): Promise<AxiosResponse> {
  let response: AxiosResponse;

  if (xmlContent) {
    // Check with XML content (for unsaved changes or new content validation)
    const encodedName = encodeSapObjectName(domainName.toLowerCase());
    const objectUri = `/sap/bc/adt/ddic/domains/${encodedName}`;
    const base64Content = Buffer.from(xmlContent, 'utf-8').toString('base64');

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="application/vnd.sap.adt.domains.v2+xml; charset=utf-8" chkrun:uri="${objectUri}">
        <chkrun:content>${base64Content}</chkrun:content>
      </chkrun:artifact>
    </chkrun:artifacts>
  </chkrun:checkObject>
</chkrun:checkObjectList>`;

    const headers = {
      Accept: 'application/vnd.sap.adt.checkmessages+xml',
      'Content-Type': 'application/vnd.sap.adt.checkobjects+xml',
    };

    const url = `/sap/bc/adt/checkruns?reporters=abapCheckRun`;

    response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      data: xmlBody,
      headers,
    });
  } else {
    // Check saved version (without XML content)
    response = await runCheckRun(
      connection,
      'domain',
      domainName,
      version,
      'abapCheckRun',
      undefined,
    );
  }

  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    // "has been checked" is a non-critical warning - domain was already checked
    const errorMessage = checkResult.message || '';
    // Check both message and errors array for "has been checked" message
    const hasCheckedMessage =
      errorMessage.toLowerCase().includes('has been checked') ||
      checkResult.errors.some((err: any) =>
        (err.text || '').toLowerCase().includes('has been checked'),
      );

    if (hasCheckedMessage) {
      // This is expected behavior - domain was already checked, return response anyway
      if (process.env.DEBUG_ADT_LIBS === 'true') {
        console.warn(
          `Check warning for domain ${domainName}: ${errorMessage} (domain was already checked)`,
        );
      }
      return response; // Return response anyway
    }
    throw new Error(`Domain check failed: ${checkResult.message}`);
  }

  return response;
}
