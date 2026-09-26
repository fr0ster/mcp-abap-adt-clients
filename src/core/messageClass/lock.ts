/**
 * Message class lock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { lockHandleOf } from '../../utils/lockHandle';
import { getTimeout } from '../../utils/timeouts';

const BASE = '/sap/bc/adt/messageclass';

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
    timeout: getTimeout('default'),
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
    timeout: getTimeout('default'),
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
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}

/**
 * The handle a message save's chain needs, as a string.
 *
 * Only `AdtMessageClassMessage.writeClass` reads it — the approved exception to
 * "one member, one request", which carries handles from one request of its
 * chain to the next. It cannot continue without one, so a lock answered with
 * no handle ends the chain here, with the same message it always had.
 */
function handleForChain(answer: IAdtWireResponse, errLabel: string): string {
  const lockHandle = lockHandleOf(answer);
  if (!lockHandle) {
    throw new Error(`Failed to extract lock handle from ${errLabel}`);
  }
  return lockHandle;
}

/**
 * The class lock a message save needs, the way Eclipse takes it.
 *
 * A capture of Eclipse 2026-08-31, creating a message class and adding
 * message 000, shows the message-scoped variant refused and the plain class lock
 * granted right after, with the plain handle going on to the PUT. Whether
 * Eclipse asks conditionally or simply sends both is not visible in the log —
 * what is visible is that the refusal is survivable and the flow continues:
 *
 *   15:54:33.587  POST …?_action=LOCK&accessMode=MODIFY&msgNo=000&onSave=X  403
 *   15:54:33.759  POST …?_action=LOCK&accessMode=MODIFY                     200
 *
 * So a 403 here is not the end of the chain. Treating it as fatal is what this
 * used to do.
 */
export async function lockClassForMessageOrPlain(
  connection: IAbapConnection,
  name: string,
  no: string,
): Promise<string> {
  try {
    return handleForChain(
      await lockClassForMessage(connection, name, no),
      'class-for-message lock response',
    );
  } catch (error) {
    const status =
      (error as { response?: { status?: number }; status?: number })?.response
        ?.status ?? (error as { status?: number })?.status;
    if (status !== 403) {
      throw error;
    }
    return handleForChain(
      await lockMessageClass(connection, name),
      'message class lock response',
    );
  }
}

/**
 * The message lock, or nothing — and nothing is a valid answer.
 *
 * `LOCK_MSG` is refused with 403 when the message class was created in this
 * same ABAP session: measured 2026-08-31, and unavoidable over RFC,
 * where one conversation is one session for its whole life. The
 * message-scoped class lock is granted in exactly that situation, and a save
 * carrying it as `mc:lockhandle` answers 200 — so a refusal here costs the
 * caller nothing but the separate handle.
 *
 * Only 403 is swallowed. Anything else is a real failure and still throws.
 */
export async function lockMessageIfGranted(
  connection: IAbapConnection,
  name: string,
  no: string,
): Promise<string | undefined> {
  try {
    return handleForChain(
      await lockMessage(connection, name, no),
      'message lock response',
    );
  } catch (error) {
    const status =
      (error as { response?: { status?: number } })?.response?.status ??
      (error as { status?: number })?.status;
    if (status !== 403) {
      throw error;
    }
    return undefined;
  }
}
