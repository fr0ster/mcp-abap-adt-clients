import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { CT_FEATURE_TOGGLE_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IFeatureToggleSource } from './types';

export async function uploadFeatureToggleSource(
  connection: IAbapConnection,
  name: string,
  source: IFeatureToggleSource,
  lockHandle: string,
  transportRequest?: string,
): Promise<void> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const params: Record<string, string> = { lockHandle };
  if (transportRequest) params.corrNr = transportRequest;
  await connection.makeAdtRequest({
    method: 'PUT',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/source/main`,
    timeout: getTimeout('default'),
    headers: {
      'Content-Type': CT_FEATURE_TOGGLE_SOURCE,
      'X-sap-adt-sessiontype': 'stateful',
    },
    params,
    data: JSON.stringify(source),
  });
}
