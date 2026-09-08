import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function unlockFeatureToggle(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    params: { _action: 'UNLOCK', lockHandle },
    // No `X-sap-adt-sessiontype` here: `setSessionType('stateful')` in the
    // handler is what puts it on this request, the same as every other type.
    // Setting it here as well meant the header could appear on a request the
    // connection did not consider stateful.
  });
}
