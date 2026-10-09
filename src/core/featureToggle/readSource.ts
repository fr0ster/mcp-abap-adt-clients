import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_FEATURE_TOGGLE_SOURCE } from '../../constants/contentTypes';
import { FEATURE_TOGGLE, sourceUri } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

export async function readFeatureToggleSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'GET',
    url: `${sourceUri(FEATURE_TOGGLE.uri(name))}`,
    timeout: getTimeout('default'),
    params: { version },
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_SOURCE },
  });
}
