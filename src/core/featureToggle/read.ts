import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_FEATURE_TOGGLE_METADATA } from '../../constants/contentTypes';
import { FEATURE_TOGGLE } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

// NOTE: withLongPolling is intentionally not accepted here. The SFW feature-
// toggle endpoint's support for it is unverified (on-prem only), so readiness
// reads are a plain GET. The public AdtFeatureToggle.read()/readMetadata()
// still accept withLongPolling to satisfy IAdtObject, but it is not forwarded.
export async function readFeatureToggle(
  connection: IAbapConnection,
  name: string,
  version: 'active' | 'inactive' = 'active',
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'GET',
    url: `${FEATURE_TOGGLE.uri(name)}`,
    timeout: getTimeout('default'),
    params: { version },
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_METADATA },
  });
}
