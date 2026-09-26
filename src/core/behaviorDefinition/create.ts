/**
 * Behavior Definition create operations - Low-level functions
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_BEHAVIOR_DEFINITION } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
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
): Promise<IAdtWireResponse> {
  const language = params.language || 'EN';

  const masterSystem = params.masterSystem || '';
  const responsible = params.responsible || '';

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
    Accept: CT_BEHAVIOR_DEFINITION,
    'Content-Type': CT_BEHAVIOR_DEFINITION,
  };

  const url = `/sap/bc/adt/bo/behaviordefinitions${params.transportRequest ? `?corrNr=${params.transportRequest}` : ''}`;

  // A refusal comes back as the transport's failure, with SAP's answer on it.
  // It used to be rewrapped in a new Error carrying the message alone, which
  // dropped the response the caller's `analyse` reads.
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
