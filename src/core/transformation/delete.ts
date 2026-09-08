import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeleteTransformationParams } from './types';

/**
 * Low-level: Check if transformation can be deleted
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteTransformationParams,
): Promise<IAdtWireResponse> {
  const { transformation_name } = params;

  if (!transformation_name) {
    throw new Error('transformation_name is required');
  }

  const encodedName = encodeSapObjectName(transformation_name);
  const objectUri = `/sap/bc/adt/xslt/transformations/${encodedName}`;

  const checkUrl = '/sap/bc/adt/deletion/check';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  const headers = {
    Accept: ACCEPT_DELETION_CHECK,
    'Content-Type': CT_DELETION_CHECK,
  };

  return await connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });
}

/**
 * Low-level: Delete transformation
 */
export async function deleteTransformation(
  connection: IAbapConnection,
  params: IDeleteTransformationParams,
): Promise<IAdtWireResponse> {
  const { transformation_name, transport_request } = params;

  if (!transformation_name) {
    throw new Error('transformation_name is required');
  }

  const encodedName = encodeSapObjectName(transformation_name);
  const objectUri = `/sap/bc/adt/xslt/transformations/${encodedName}`;

  const deletionUrl = '/sap/bc/adt/deletion/delete';

  // Transformations require empty transportNumber tag if no transport request
  let transportNumberTag = '';
  if (transport_request?.trim()) {
    transportNumberTag = `<del:transportNumber>${transport_request}</del:transportNumber>`;
  } else {
    transportNumberTag = '<del:transportNumber/>';
  }

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;

  const headers = {
    Accept: ACCEPT_DELETION,
    'Content-Type': CT_DELETION,
  };

  const response = await connection.makeAdtRequest({
    url: deletionUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });

  // The response, as it arrived. This used to replace the server's document
  // with `{ success: true, …, message: '… deleted successfully' }` — prose this
  // library wrote about a call it had not read, handed to a caller in place of
  // what SAP said. What a caller wants out of the answer is the reading's
  // question; the writer's job is to hand the answer over.
  return response;
}
