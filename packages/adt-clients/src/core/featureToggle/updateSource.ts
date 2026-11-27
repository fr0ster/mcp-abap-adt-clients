import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FEATURE_TOGGLE, sourceUri } from '../../endpoints/objects';
import { updateRequestHeaders } from '../../utils/requestHeaders';
import type { IFeatureToggleSource } from './types';

export async function uploadFeatureToggleSource(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  ifMatch: string | undefined,
  name: string,
  // Absent, the body is what `JSON.stringify(undefined)` gives, as before.
  source: IFeatureToggleSource | undefined,
  lockHandle: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  // The handle is required, and sent as given (C7 of #304).
  const params: Record<string, string> = { lockHandle };
  if (transportRequest) params.corrNr = transportRequest;
  return connection.makeAdtRequest({
    method: 'PUT',
    url: `${sourceUri(FEATURE_TOGGLE.uri(name))}`,
    timeout: 0,
    headers: updateRequestHeaders(headers, ifMatch, 'kept'),
    params,
    data: JSON.stringify(source),
  });
}
