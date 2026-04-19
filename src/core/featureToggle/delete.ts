/**
 * Feature Toggle (FTG2/FT) delete operations - Low-level functions
 */

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
import type { IDeleteFeatureToggleParams } from './types';

function objectUri(name: string): string {
  return `/sap/bc/adt/sfw/featuretoggles/${encodeSapObjectName(name.toLowerCase())}`;
}

/**
 * Low-level: Check if feature toggle can be deleted
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteFeatureToggleParams,
): Promise<AxiosResponse> {
  if (!params.feature_toggle_name) {
    throw new Error('feature_toggle_name is required');
  }

  const uri = objectUri(params.feature_toggle_name);

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}"/>
</del:checkRequest>`;

  return connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/check',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      Accept: ACCEPT_DELETION_CHECK,
      'Content-Type': CT_DELETION_CHECK,
    },
  });
}

/**
 * Low-level: Delete feature toggle
 */
export async function deleteFeatureToggle(
  connection: IAbapConnection,
  params: IDeleteFeatureToggleParams,
): Promise<AxiosResponse> {
  if (!params.feature_toggle_name) {
    throw new Error('feature_toggle_name is required');
  }

  const uri = objectUri(params.feature_toggle_name);
  const transportTag = params.transport_request?.trim()
    ? `<del:transportNumber>${params.transport_request}</del:transportNumber>`
    : '<del:transportNumber/>';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${uri}">
    ${transportTag}
  </del:object>
</del:deletionRequest>`;

  const response = await connection.makeAdtRequest({
    url: '/sap/bc/adt/deletion/delete',
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers: {
      Accept: ACCEPT_DELETION,
      'Content-Type': CT_DELETION,
    },
  });

  return {
    ...response,
    data: {
      success: true,
      feature_toggle_name: params.feature_toggle_name,
      object_uri: uri,
      transport_request: params.transport_request || 'local',
      message: `Feature toggle ${params.feature_toggle_name} deleted successfully`,
    },
  } as AxiosResponse;
}
