import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_METADATA } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export interface IReadOptions {
  withLongPolling?: boolean;
}

export async function readFeatureToggle(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
  _options?: IReadOptions,
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    params: { version },
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_METADATA },
  });
}
