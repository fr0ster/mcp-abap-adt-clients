/**
 * DataElement check operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { DATA_ELEMENT } from '../../endpoints/objects';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';
import { requestHeaders } from '../../utils/requestHeaders';

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
  headers: IAdtHeaders,
  dataElementName: string,
  version: CheckRunVersion = 'active',
  xmlContent?: string,
): Promise<IAdtWireResponse> {
  let response: IAdtWireResponse;

  if (xmlContent) {
    // Check with XML content (for unsaved changes or new content validation)
    const objectUri = `${DATA_ELEMENT.uri(dataElementName)}`;
    const base64Content = Buffer.from(xmlContent, 'utf-8').toString('base64');

    // TODO: analyze whether chkrun:contentType can be extracted to a constant
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

    const url = `/sap/bc/adt/checkruns?reporters=abapCheckRun`;

    response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: 0,
      data: xmlBody,
      headers: requestHeaders(headers),
    });
  } else {
    // Check saved version (without XML content)
    response = await runCheckRun(
      connection,
      headers,
      { type: 'DTEL/DE', name: dataElementName },
      version,
      'abapCheckRun',
      undefined,
    );
  }

  return response;
}
