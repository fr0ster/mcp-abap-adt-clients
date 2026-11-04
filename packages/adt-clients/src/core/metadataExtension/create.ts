/**
 * Create Metadata Extension (DDLX)
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { METADATA_EXTENSION } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { createRequestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr, languageAttributes } from '../../utils/xml';
import type { IMetadataExtensionCreateParams } from './types';

/**
 * Create a new metadata extension (DDLX)
 *
 * @param connection - ABAP connection instance
 * @param params - Creation parameters
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with created metadata extension details
 *
 * @example
 * ```typescript
 * const response = await createMetadataExtension(connection, {
 *   name: 'ZDEMO_C_CDS_MDE',
 *   description: 'First metadata extension',
 *   packageName: 'ZDEMO_PKG',
 *   transportRequest: 'DEVK900123'
 * }, sessionId);
 * ```
 */
export async function createMetadataExtension(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IMetadataExtensionCreateParams,
): Promise<IAdtWireResponse> {
  const url = METADATA_EXTENSION.collection;

  const masterSystem = params.masterSystem || '';
  const responsible = params.responsible || '';

  // Description is limited to 60 characters in SAP ADT
  // Cut first, escaped after: an entity is never cut in two.
  const description = escapeXmlAttr(limitDescription(params.description));
  // Build XML with conditional attributes
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(masterSystem)}"`
    : '';
  const responsibleAttr = responsible
    ? ` adtcore:responsible="${escapeXmlAttr(responsible)}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><ddlxsources:ddlxSource xmlns:ddlxsources="http://www.sap.com/adt/ddic/ddlxsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}"${languageAttributes(params.masterLanguage)} adtcore:name="${escapeXmlAttr(params.name)}" adtcore:type="${TYPE_CODE.metadataExtension}"${masterSystemAttr}${responsibleAttr}>
    ${
      params.transportRequest
        ? `<adtcore:packageRef adtcore:name="${escapeXmlAttr(params.packageName)}">
    <adtcore:properties>
      <adtcore:property adtcore:name="abapLanguageVersion" adtcore:value=""/>
    </adtcore:properties>
  </adtcore:packageRef>
  <adtcore:transportInfo>
    <adtcore:localObject/>
  </adtcore:transportInfo>`
        : `<adtcore:packageRef adtcore:name="${escapeXmlAttr(params.packageName)}"/>`
    }

</ddlxsources:ddlxSource>`;

  const queryParams = params.transportRequest
    ? { corrNr: params.transportRequest }
    : undefined;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: createRequestHeaders(headers, params.masterLanguage),
    params: queryParams,
  });
}
