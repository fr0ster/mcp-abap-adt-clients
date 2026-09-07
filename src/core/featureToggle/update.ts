import type {
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
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
  lockHandle?: string,
  _logger?: ILogger,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(params.feature_toggle_name.toLowerCase());
  const xml = buildFeatureToggleXml(params);
  const query: Record<string, string> = {};
  if (lockHandle) query.lockHandle = lockHandle;
  if (params.transport_request) query.corrNr = params.transport_request;
  return connection.makeAdtRequest({
    method: 'PUT',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_METADATA,
      Accept: ACCEPT_FEATURE_TOGGLE_METADATA,
      // No `X-sap-adt-sessiontype` here. A write is stateless — Eclipse sends
      // it that way, carrying only `lockHandle` and `corrNr` — and the header
      // was set on the request while the connection's own mode was stateless,
      // so the connector never knew: measured on the trial, this PUT went out
      // labelled stateful without the `sap-adt-request-id` the connector adds
      // in that mode. What the server takes during a request that runs inside
      // the session is held by that session, which is what
      // `stateful covers the lock request, not the window` removed everywhere
      // else.
    },
    params: query,
    data: xml,
  });
}
