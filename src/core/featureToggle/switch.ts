import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IToggleFeatureToggleParams } from './types';

export async function toggleFeatureToggle(
  connection: IAbapConnection,
  params: IToggleFeatureToggleParams,
): Promise<void> {
  const encoded = encodeSapObjectName(params.feature_toggle_name.toLowerCase());
  const body: { TOGGLE_PARAMETERS: Record<string, unknown> } = {
    TOGGLE_PARAMETERS: {
      IS_USER_SPECIFIC: Boolean(params.is_user_specific),
      STATE: params.state,
    },
  };
  if (params.transport_request) {
    body.TOGGLE_PARAMETERS.TRANSPORT_REQUEST = params.transport_request;
  }
  await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/toggle`,
    timeout: getTimeout('default'),
    headers: { 'Content-Type': CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS },
    data: JSON.stringify(body),
  });
}
