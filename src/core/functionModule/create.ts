/**
 * FunctionModule create operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_FUNCTION_MODULE } from '../../constants/contentTypes';
import { FUNCTION_GROUP, FUNCTION_MODULE } from '../../endpoints/objects';
import {
  encodeSapObjectName,
  limitDescription,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateFunctionModuleParams } from './types';

/**
 * Create function module metadata
 * Low-level function - creates metadata without workflow logic
 */
export async function create(
  connection: IAbapConnection,
  params: ICreateFunctionModuleParams,
): Promise<IAdtWireResponse> {
  const url = `${FUNCTION_MODULE.collection(params.functionGroupName)}${params.transportRequest ? `?corrNr=${params.transportRequest}` : ''}`;

  const masterSystem = params.masterSystem || undefined;
  const username = params.responsible || undefined;

  // Description is limited to 60 characters in SAP ADT
  const limitedDescription = limitDescription(params.description);
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<fmodule:abapFunctionModule xmlns:fmodule="http://www.sap.com/adt/functions/fmodules" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${limitedDescription}" adtcore:name="${params.functionModuleName}" adtcore:type="FUGR/FF"${masterSystemAttr}${responsibleAttr}>
  <adtcore:containerRef adtcore:name="${params.functionGroupName}" adtcore:type="FUGR/F" adtcore:uri="${FUNCTION_GROUP.uri(params.functionGroupName)}"/>
</fmodule:abapFunctionModule>`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      'Content-Type': CT_FUNCTION_MODULE,
      Accept: CT_FUNCTION_MODULE,
    },
  });
}
