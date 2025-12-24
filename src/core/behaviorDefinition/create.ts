/**
 * Behavior Definition create operations - Low-level functions
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import type { IBehaviorDefinitionCreateParams } from './types';

/**
 * Create a new behavior definition
 *
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions
 *
 * @param connection - ABAP connection instance
 * @param params - Creation parameters
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with created object metadata
 *
 * @example
 * ```typescript
 * const response = await create(connection, {
 *   name: 'Z_MY_BDEF',
 *   description: 'My Behavior Definition',
 *   package: 'Z_PACKAGE',
 *   implementationType: 'Managed'
 * }, sessionId);
 *
 * // Extract source URI
 * const sourceUri = response.data.match(/abapsource:sourceUri="([^"]+)"/)?.[1];
 * ```
 */
export async function create(
  connection: IAbapConnection,
  params: IBehaviorDefinitionCreateParams,
): Promise<AxiosResponse> {
  try {
    const language = params.language || 'EN';

    // Get system information (for cloud systems)
    let masterSystem = 'TRL';
    let responsible = params.responsible;

    const systemInfo = await getSystemInformation(connection);
    if (systemInfo) {
      masterSystem = systemInfo.systemID || masterSystem;
      responsible = responsible || systemInfo.userName;
    }

    // Fallback to env username if not provided
    responsible =
      responsible || process.env.SAP_USERNAME || process.env.SAP_USER || '';

    // Description is limited to 60 characters in SAP ADT
    const description = limitDescription(params.description);
    const masterSystemAttr = masterSystem
      ? ` adtcore:masterSystem="${masterSystem}"`
      : '';
    const responsibleAttr = responsible
      ? ` adtcore:responsible="${responsible}"`
      : '';

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${language}" adtcore:name="${params.name}" adtcore:type="BDEF/BDO" adtcore:masterLanguage="${language}"${masterSystemAttr}${responsibleAttr}>
    <adtcore:adtTemplate>
        <adtcore:adtProperty adtcore:key="implementation_type">${params.implementationType}</adtcore:adtProperty>
    </adtcore:adtTemplate>
    <adtcore:packageRef adtcore:name="${params.package}"/>
</blue:blueSource>`;

    const headers = {
      Accept: 'application/vnd.sap.adt.blues.v1+xml',
      'Content-Type': 'application/vnd.sap.adt.blues.v1+xml',
    };

    const url = '/sap/bc/adt/bo/behaviordefinitions';

    const response = await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      data: xmlBody,
      headers,
    });

    return response;
  } catch (error: any) {
    throw new Error(
      `Failed to create behavior definition ${params.name}: ${error.message}`,
    );
  }
}
