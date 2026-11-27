/**
 * Message class lock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { MESSAGE_CLASS } from '../../endpoints/objects';
import { encodeSapObjectName } from '../../utils/internalUtils';

const BASE = MESSAGE_CLASS.collection;

// Accept header for individual message lock (StatusMessage response type)
const ACCEPT_LOCK_MSG =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage';

/**
 * Lock a message class for modification — `POST …?_action=LOCK`, answered as
 * it arrived. `lockHandleOf` reads the handle.
 *
 * Until 23.0.0 this parsed the handle and threw when SAP's answer had none.
 *
 * NOTE: Caller must enable stateful session via connection.setSessionType('stateful') first.
 */
export async function lockMessageClass(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    url: `${BASE}/${encoded}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: 0,
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}

/**
 * Lock an individual message for modification — answered as it arrived. Its
 * handle (MH) goes into the PUT XML as mc:lockhandle.
 *
 * NOTE: Caller must enable stateful session via connection.setSessionType('stateful') first.
 */
export async function lockMessage(
  connection: IAbapConnection,
  name: string,
  no: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    url: `${BASE}/${encoded}/messages/${encodeURIComponent(no)}?_action=LOCK_MSG&accessMode=MODIFY`,
    method: 'POST',
    timeout: 0,
    data: null,
    headers: { Accept: ACCEPT_LOCK_MSG },
  });
}

/**
 * Lock a message class in the context of a specific message save — answered
 * as it arrived. Its handle (CH) goes into the PUT's ?lockHandle= parameter.
 *
 * NOTE: Caller must enable stateful session via connection.setSessionType('stateful') first.
 */
export async function lockClassForMessage(
  connection: IAbapConnection,
  name: string,
  no: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    url: `${BASE}/${encoded}?_action=LOCK&accessMode=MODIFY&msgNo=${encodeURIComponent(no)}&onSave=X`,
    method: 'POST',
    timeout: 0,
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}
