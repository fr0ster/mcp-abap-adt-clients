import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FEATURE_TOGGLE } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { ICreateFeatureToggleParams } from './types';
import { buildFeatureToggleXml } from './xmlBuilder';

export async function create(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: ICreateFeatureToggleParams,
): Promise<IAdtWireResponse> {
  const xml = buildFeatureToggleXml(args);
  const params: Record<string, string> = {};
  if (args.transport_request) params.corrNr = args.transport_request;
  return connection.makeAdtRequest({
    method: 'POST',
    url: FEATURE_TOGGLE.collection,
    timeout: 0,
    headers: requestHeaders(headers),
    params,
    data: xml,
  });
}
