import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FEATURE_TOGGLE } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

export async function unlockFeatureToggle(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'POST',
    url: `${FEATURE_TOGGLE.uri(name)}`,
    timeout: getTimeout('default'),
    params: { _action: 'UNLOCK', lockHandle },
    // No `X-sap-adt-sessiontype` here: `setSessionType('stateful')` in the
    // handler is what puts it on this request, the same as every other type.
    // Setting it here as well meant the header could appear on a request the
    // connection did not consider stateful.
  });
}
