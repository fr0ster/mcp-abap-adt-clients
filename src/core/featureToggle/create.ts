import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_FEATURE_TOGGLE_METADATA,
  CT_FEATURE_TOGGLE_METADATA,
} from '../../constants/contentTypes';
import { FEATURE_TOGGLE } from '../../endpoints/objects';
import type { ICreateFeatureToggleParams } from './types';
import { buildFeatureToggleXml } from './xmlBuilder';

export async function create(
  connection: IAbapConnection,
  args: ICreateFeatureToggleParams,
): Promise<IAdtWireResponse> {
  const xml = buildFeatureToggleXml(args);
  const params: Record<string, string> = {};
  if (args.transport_request) params.corrNr = args.transport_request;
  return connection.makeAdtRequest({
    method: 'POST',
    url: FEATURE_TOGGLE.collection,
    timeout: 0,
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_METADATA,
      Accept: ACCEPT_FEATURE_TOGGLE_METADATA,
    },
    params,
    data: xml,
  });
}
