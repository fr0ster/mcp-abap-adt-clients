import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS } from '../../constants/contentTypes';
import { FEATURE_TOGGLE } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';
import type { IToggleFeatureToggleParams } from './types';

export async function toggleFeatureToggle(
  connection: IAbapConnection,
  params: IToggleFeatureToggleParams,
): Promise<IAdtWireResponse> {
  const body: { TOGGLE_PARAMETERS: Record<string, unknown> } = {
    TOGGLE_PARAMETERS: {
      IS_USER_SPECIFIC: Boolean(params.is_user_specific),
      STATE: params.state,
    },
  };
  if (params.transport_request) {
    body.TOGGLE_PARAMETERS.TRANSPORT_REQUEST = params.transport_request;
  }
  return connection.makeAdtRequest({
    method: 'POST',
    url: `${FEATURE_TOGGLE.uri(params.feature_toggle_name)}/toggle`,
    timeout: getTimeout('default'),
    headers: { 'Content-Type': CT_FEATURE_TOGGLE_TOGGLE_PARAMETERS },
    data: JSON.stringify(body),
  });
}
