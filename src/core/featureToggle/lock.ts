import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` on the feature toggle — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it and threw when SAP's answer had none, which turned a statement about SAP's
 * answer into a library failure and dropped the answer.
 */
export async function lockFeatureToggle(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    params: { _action: 'LOCK', accessMode: 'MODIFY' },
    headers: {
      // No `X-sap-adt-sessiontype` here: `setSessionType('stateful')` in the
      // handler is what puts it on this request, the same as every other type.
      // Setting it here as well meant the header could appear on a request the
      // connection did not consider stateful.
      Accept:
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result2,' +
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result',
    },
  });
}
