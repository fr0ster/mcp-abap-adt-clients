import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_FEATURE_TOGGLE_METADATA,
  CT_FEATURE_TOGGLE_METADATA,
} from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateFeatureToggleParams } from './types';
import { buildFeatureToggleXml } from './xmlBuilder';

export async function create(
  connection: IAbapConnection,
  args: ICreateFeatureToggleParams,
): Promise<AxiosResponse> {
  const xml = buildFeatureToggleXml(args);
  const params: Record<string, string> = {};
  if (args.transport_request) params.corrNr = args.transport_request;
  return connection.makeAdtRequest({
    method: 'POST',
    url: '/sap/bc/adt/sfw/featuretoggles',
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_METADATA,
      Accept: ACCEPT_FEATURE_TOGGLE_METADATA,
    },
    params,
    data: xml,
  });
}
