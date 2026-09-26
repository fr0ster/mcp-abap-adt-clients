/**
 * Locking a service binding — which is what publishing one is.
 *
 * A binding is not edited the way a class is: it is created, and then published
 * and unpublished. Measured from Eclipse (ADT 3.60.3) on the BTP trial,
 * 2026-09-05, the lock is what those two take:
 *
 * ```
 * POST …/bindings/zac_srvb01?_action=LOCK&accessMode=MODIFY   200  (stateful)
 * POST …/odatav4/publishjobs                                  200  (stateless, 133s)
 * …
 * POST …/bindings/zac_srvb01?_action=UNLOCK&lockHandle=6B35…  200  "Closing editor"
 * ```
 *
 * Eclipse holds one lock for as long as the editor is open and releases it when
 * the editor closes. A library has no editor, so the edit is the operation:
 * lock, publish or unpublish, unlock — the shape every other type's update
 * already has.
 *
 * Skipping the lock is how a binding ends up refusing its own delete with
 * `You are already editing`, and a `_action=LOCK` from anywhere else with
 * `403 ExceptionResourceNoAccess`.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const bindingUri = (name: string): string =>
  `/sap/bc/adt/businessservices/bindings/${encodeSapObjectName(name.toLowerCase())}`;

/**
 * Take the lock — `POST …?_action=LOCK`, answered as it arrived. The member
 * reads the handle with `lockHandleOf`; until 23.0.0 this parsed it and threw
 * when SAP's answer had none, which dropped the answer.
 */
export async function lockServiceBinding(
  connection: IAbapConnection,
  bindingName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${bindingUri(bindingName)}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_LOCK },
  });
}

/** Give it back. Without this the binding stays "currently being edited". */
export async function unlockServiceBinding(
  connection: IAbapConnection,
  bindingName: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${bindingUri(bindingName)}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
