/**
 * DataElement check operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Check data element syntax
 *
 * @param connection - SAP connection
 * @param dataElementName - Data element name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param xmlContent - Optional XML content to validate (same format as PUT body). If provided, check validates this content instead of saved version.
 * @returns Check result with errors/warnings
 *
 * Note: For DDIC objects like data elements, check may not be fully supported in all SAP systems.
 * If check fails with "importing from database" error, it's often safe to skip.
 * When xmlContent is provided, it should be the same XML that will be sent in PUT request.
 */
export async function checkDataElement(
  connection: IAbapConnection,
  dataElementName: string,
  version: string = 'active',
  xmlContent?: string,
): Promise<AxiosResponse> {
  let response: AxiosResponse;

  if (xmlContent) {
    // Check with XML content (for unsaved changes or new content validation)
    const encodedName = encodeSapObjectName(dataElementName.toLowerCase());
    const objectUri = `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    const base64Content = Buffer.from(xmlContent, 'utf-8').toString('base64');

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
  <chkrun:checkObject adtcore:uri="${objectUri}" chkrun:version="${version}">
    <chkrun:artifacts>
      <chkrun:artifact chkrun:contentType="application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8" chkrun:uri="${objectUri}">
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
      'data_element',
      dataElementName,
      version,
      'abapCheckRun',
      undefined,
    );
  }

  const checkResult = parseCheckRunResponse(response);

  // Check only for type E messages - HTTP 200 is normal, errors are in XML response
  if (checkResult.errors.length > 0) {
    const errorTexts = checkResult.errors
      .map((err) => err.text || '')
      .join(' ')
      .toLowerCase();

    // Ignore messages that should not cause failure
    const shouldIgnore =
      errorTexts.includes('has been checked') ||
      errorTexts.includes('was checked') ||
      (errorTexts.includes('importing') && errorTexts.includes('database')) ||
      // For newly created empty data elements, these errors are expected until object is fully initialized
      (errorTexts.includes('no domain') &&
        errorTexts.includes('data type was defined')) ||
      errorTexts.includes('datatype is expected');

    if (!shouldIgnore) {
      // Has type E errors that should not be ignored - throw error
      const errorMessages = checkResult.errors
        .map((err) => err.text)
        .join('; ');
      throw new Error(`Data element check failed: ${errorMessages}`);
    }
  }

  return response;
}
