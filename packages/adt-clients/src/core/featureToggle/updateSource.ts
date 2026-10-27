import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FEATURE_TOGGLE, sourceUri } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IFeatureToggleSource } from './types';

export async function uploadFeatureToggleSource(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
  source: IFeatureToggleSource,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  // The handle is sent when there is one. Whether an unlocked write is allowed
  // is ADT's judgement about this toggle on this system, not a refusal to raise
  // here — the same rule every other write in this package follows.
  const params: Record<string, string> = {};
  if (lockHandle) params.lockHandle = lockHandle;
  if (transportRequest) params.corrNr = transportRequest;
  return connection.makeAdtRequest({
    method: 'PUT',
    url: `${sourceUri(FEATURE_TOGGLE.uri(name))}`,
    timeout: 0,
    headers: requestHeaders(headers),
    params,
    data: JSON.stringify(source),
  });
}
