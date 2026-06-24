import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeleteScalarFunctionImplementationParams } from './types';

function objectUri(name: string): string {
  return `/sap/bc/adt/ddic/dsfi/${encodeSapObjectName(name.toLowerCase())}`;
}

export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteScalarFunctionImplementationParams,
): Promise<AxiosResponse> {
  if (!params.implementation_name)
    throw new Error('implementation_name is required');
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.implementation_name)}"/>
</del:checkRequest>`;
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/deletion/check`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      Accept: ACCEPT_DELETION_CHECK,
      'Content-Type': CT_DELETION_CHECK,
    },
  });
}

export async function deleteScalarFunctionImplementation(
  connection: IAbapConnection,
  params: IDeleteScalarFunctionImplementationParams,
): Promise<AxiosResponse> {
  if (!params.implementation_name)
    throw new Error('implementation_name is required');
  const transportNumberTag = params.transport_request?.trim()
    ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
    : '<del:transportNumber/>';
  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri(params.implementation_name)}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;
  const response = await connection.makeAdtRequest({
    url: `/sap/bc/adt/deletion/delete`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: { Accept: ACCEPT_DELETION, 'Content-Type': CT_DELETION },
  });
  return {
    ...response,
    data: {
      success: true,
      implementation_name: params.implementation_name,
      object_uri: objectUri(params.implementation_name),
      transport_request: params.transport_request || 'local',
      message: `Scalar function implementation ${params.implementation_name} deleted successfully`,
    },
  } as AxiosResponse;
}
