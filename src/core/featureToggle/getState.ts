import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_FEATURE_TOGGLE_STATES } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * `GET …/states` — the toggle's runtime state, the JSON as it arrived.
 *
 * Until 23.0.0 this parsed the `STATES` object and normalised it into
 * `IFeatureToggleRuntimeState` here (now `featureToggleRuntimeState` in @mcp-abap-adt/adt-strategies), so every caller got that reading whether
 * they wanted it or not. The reading is the `runtimeState` strategy's now.
 */
export async function getFeatureToggleState(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    method: 'GET',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}/states`,
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_FEATURE_TOGGLE_STATES },
  });
}
