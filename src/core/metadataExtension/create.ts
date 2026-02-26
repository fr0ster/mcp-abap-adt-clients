/**
 * Create Metadata Extension (DDLX)
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
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
 *   name: 'ZOK_C_CDS_TEST_0001',
 *   description: 'First metadata extension',
 *   packageName: 'ZOK_TEST_000222',
 *   transportRequest: 'TRLK900123'
 * }, sessionId);
 * ```
 */
export async function createMetadataExtension(
  connection: IAbapConnection,
  params: IMetadataExtensionCreateParams,
): Promise<AxiosResponse> {
  const url = '/sap/bc/adt/ddic/ddlx/sources';

  // Get system information - only for cloud systems
  const systemInfo = await getSystemInformation(connection);
  const username = systemInfo?.userName || '';
  const systemId = systemInfo?.systemID || '';

  const masterLanguage = params.masterLanguage || 'EN';

  // Only add masterSystem and responsible for cloud systems (when systemInfo is available)
  const masterSystem = systemInfo ? params.masterSystem || systemId : '';
  const responsible = systemInfo ? params.responsible || username : '';

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(params.description);
  // Build XML with conditional attributes
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = responsible
    ? ` adtcore:responsible="${responsible}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><ddlxsources:ddlxSource xmlns:ddlxsources="http://www.sap.com/adt/ddic/ddlxsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${params.name}" adtcore:type="DDLX/EX" adtcore:masterLanguage="${masterLanguage}"${masterSystemAttr}${responsibleAttr}>
    ${
      params.transportRequest
        ? `<adtcore:packageRef adtcore:name="${params.packageName}">
    <adtcore:properties>
      <adtcore:property adtcore:name="abapLanguageVersion" adtcore:value=""/>
    </adtcore:properties>
  </adtcore:packageRef>
  <adtcore:transportInfo>
    <adtcore:localObject/>
  </adtcore:transportInfo>`
        : `<adtcore:packageRef adtcore:name="${params.packageName}"/>`
    }
  
</ddlxsources:ddlxSource>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.ddic.ddlx.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.ddic.ddlx.v1+xml',
  };

  const queryParams = params.transportRequest
    ? { corrNr: params.transportRequest }
    : undefined;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
    params: queryParams,
  });
}
