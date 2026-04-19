import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_FEATURE_TOGGLE_METADATA,
  CT_FEATURE_TOGGLE_METADATA,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateFeatureToggleParams } from './types';
import { buildFeatureToggleXml } from './xmlBuilder';

export async function updateFeatureToggle(
  connection: IAbapConnection,
  params: ICreateFeatureToggleParams,
  lockHandle: string,
  _logger?: ILogger,
): Promise<void> {
  const encoded = encodeSapObjectName(params.feature_toggle_name.toLowerCase());
  const xml = buildFeatureToggleXml(params);
  const query: Record<string, string> = { lockHandle };
  if (params.transport_request) query.corrNr = params.transport_request;
  await connection.makeAdtRequest({
    method: 'PUT',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_METADATA,
      Accept: ACCEPT_FEATURE_TOGGLE_METADATA,
      'X-sap-adt-sessiontype': 'stateful',
    },
    params: query,
    data: xml,
  });
}
