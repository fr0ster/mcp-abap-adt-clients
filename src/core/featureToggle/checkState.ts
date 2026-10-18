import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FEATURE_TOGGLE } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * `POST …/check` — the toggle's current state and what changing it would
 * need, the JSON as it arrived.
 *
 * Until 23.0.0 this parsed the `RESULT` object and normalised it into
 * `IFeatureToggleCheckStateResult` here (now `featureToggleCheckState` in @mcp-abap-adt/adt-strategies). The reading is the `checkState`
 * strategy's now.
 */
export async function checkFeatureToggleState(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
  opts?: { userSpecific?: boolean },
): Promise<IAdtWireResponse> {
  const body = {
    PARAMETERS: { IS_USER_SPECIFIC: Boolean(opts?.userSpecific) },
  };
  return connection.makeAdtRequest({
    method: 'POST',
    url: `${FEATURE_TOGGLE.uri(name)}/check`,
    timeout: 0,
    headers: requestHeaders(headers),
    data: JSON.stringify(body),
  });
}
