import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function readFeatureToggleSource(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/source/main`,
    timeout: getTimeout('default'),
    params: { version },
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_SOURCE },
  });
}
