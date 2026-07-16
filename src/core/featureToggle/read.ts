import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_FEATURE_TOGGLE_METADATA } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

// NOTE: withLongPolling is intentionally not accepted here. The SFW feature-
// toggle endpoint's support for it is unverified (on-prem only), so readiness
// reads are a plain GET. The public AdtFeatureToggle.read()/readMetadata()
// still accept withLongPolling to satisfy IAdtObject, but it is not forwarded.
export async function readFeatureToggle(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
): Promise<AxiosResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    params: { version },
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_METADATA },
  });
}
