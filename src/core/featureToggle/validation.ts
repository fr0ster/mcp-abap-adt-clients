import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_METADATA } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

export async function validateFeatureToggleName(
  connection: IAbapConnection,
  name: string,
  _packageName?: string,
  _description?: string,
): Promise<AxiosResponse> {
  if (!name) {
    throw new Error('Feature toggle name is required');
  }
  return connection.makeAdtRequest({
    method: 'GET',
    url: '/sap/bc/adt/sfw/featuretoggles',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_METADATA },
  });
}
