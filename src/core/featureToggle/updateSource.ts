import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { CT_FEATURE_TOGGLE_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IFeatureToggleSource } from './types';

export async function uploadFeatureToggleSource(
  connection: IAbapConnection,
  name: string,
  source: IFeatureToggleSource,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  // The handle is sent when there is one. Whether an unlocked write is allowed
  // is ADT's judgement about this toggle on this system, not a refusal to raise
  // here — the same rule every other write in this package follows.
  const params: Record<string, string> = {};
  if (lockHandle) params.lockHandle = lockHandle;
  if (transportRequest) params.corrNr = transportRequest;
  return connection.makeAdtRequest({
    method: 'PUT',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/source/main`,
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_SOURCE,
      // No `X-sap-adt-sessiontype` here. A write is stateless — Eclipse sends
      // it that way, carrying only `lockHandle` and `corrNr` — and the header
      // was set on the request while the connection's own mode was stateless,
      // so the connector never knew: measured , this PUT went out
      // labelled stateful without the `sap-adt-request-id` the connector adds
      // in that mode. What the server takes during a request that runs inside
      // the session is held by that session, which is what
      // `stateful covers the lock request, not the window` removed everywhere
      // else.
    },
    params,
    data: JSON.stringify(source),
  });
}
