import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { FEATURE_TOGGLE } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { ICreateFeatureToggleParams } from './types';
import { buildFeatureToggleXml } from './xmlBuilder';

/** *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateFeatureToggle(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: ICreateFeatureToggleParams,
  lockHandle?: string,
  _logger?: ILogger,
): Promise<IAdtWireResponse> {
  const xml = buildFeatureToggleXml(params);
  const query: Record<string, string> = {};
  if (lockHandle) query.lockHandle = lockHandle;
  if (params.transport_request) query.corrNr = params.transport_request;
  return connection.makeAdtRequest({
    method: 'PUT',
    url: `${FEATURE_TOGGLE.uri(params.feature_toggle_name)}`,
    timeout: 0,
    headers: requestHeaders(headers),
    params: query,
    data: xml,
  });
}
