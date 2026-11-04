/**
 * FunctionModule create operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_CODE } from '../../constants/typeCodes';
import { FUNCTION_GROUP, FUNCTION_MODULE } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateFunctionModuleParams } from './types';

/**
 * Create function module metadata
 * Low-level function - creates metadata without workflow logic
 */
export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: ICreateFunctionModuleParams,
): Promise<IAdtWireResponse> {
  const url = `${FUNCTION_MODULE.collection(params.functionGroupName)}${params.transportRequest ? `?corrNr=${params.transportRequest}` : ''}`;

  const masterSystem = params.masterSystem || undefined;
  const username = params.responsible || undefined;

  // Description is limited to 60 characters in SAP ADT
  // Cut first, escaped after: an entity is never cut in two.
  const limitedDescription = escapeXmlAttr(
    limitDescription(params.description),
  );
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${escapeXmlAttr(masterSystem)}"`
    : '';
  const responsibleAttr = username
    ? ` adtcore:responsible="${escapeXmlAttr(username)}"`
    : '';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:name="${escapeXmlAttr(params.functionModuleName)}" adtcore:type="${TYPE_CODE.functionModule}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:containerRef adtcore:name="${escapeXmlAttr(params.functionGroupName)}" adtcore:type="${TYPE_CODE.functionGroup}" adtcore:uri="${escapeXmlAttr(FUNCTION_GROUP.uri(params.functionGroupName))}"/>
</fmodule:abapFunctionModule>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlPayload,
    headers: requestHeaders(headers),
  });
}
