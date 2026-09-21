/**
 * The three user actions ADT performs on a request's object list, and the log
 * that records them.
 *
 * **Why these are members and not something a caller composes.** The listing
 * already hands back every `atom:link` a request and its tasks carry —
 * `release`, `addobject`, `changeowner`, `newtask` — and says why in
 * `ITransportTreeLink`: *"so a caller follows an href rather than assembling a
 * URL by convention"*. Following one meant issuing a raw request with a
 * hand-built `tm:root` and a `useraction` attribute, which is the same gap
 * `searchConfigurations()` closed for the listing in 19.1.0.
 *
 * **What it costs to lack them.** A deleted object keeps its CTS
 * object-directory entry tied to the request that carried it — SAP says so
 * when it happens: *"Release transport … to remove the object directory
 * entry."* Until the entry is detached, creating the same name again fails
 * with `CTS_WBO_API 019`, **even when the same request is passed as
 * `corrNr`**. Without `removeobject` the only ways out are releasing the whole
 * request, shipping everything else in it, or SE09 by hand.
 *
 * **The headers are the server's, not a guess.** Both `PUT`s go out as
 * `Content-Type: text/plain` with `Accept:
 * application/vnd.sap.adt.transportorganizer.v1+xml`. That pairing looks
 * wrong for an XML body and is what Eclipse ADT 3.60.0 sends (captured against
 * an on-premise system, 2026-09-21); it is pinned in a test so it is not
 * "corrected" later by someone reading only the body.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IAbapObjectEntry } from './types';

/** `text/plain`, as the server is sent it. See the note above. */
const USER_ACTION_HEADERS = {
  'Content-Type': 'text/plain',
  Accept: ACCEPT_TRANSPORT,
} as const;

const requestUrl = (number: string): string =>
  `/sap/bc/adt/cts/transportrequests/${encodeSapObjectName(number)}`;

/** `&`, `<` and `"` in an attribute value would otherwise break the body. */
const attribute = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * The `tm:root` both object actions send.
 *
 * `tm:position` and `tm:obj_desc` are written only when given. The capture
 * carried both on `removeobject` and neither on `addobject`, and no
 * measurement says whether the server needs them, so neither is invented here.
 */
function userActionDocument(
  number: string,
  action: 'removeobject' | 'addobject',
  object: IAbapObjectEntry,
): string {
  const optional = [
    object.description === undefined
      ? ''
      : ` tm:obj_desc="${attribute(object.description)}"`,
    object.position === undefined
      ? ''
      : ` tm:position="${attribute(object.position)}"`,
  ].join('');

  return (
    '<?xml version="1.0" encoding="ASCII"?>\n' +
    `<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="${attribute(number)}" tm:useraction="${action}">\n` +
    '  <tm:request>\n' +
    `    <tm:abap_object tm:pgmid="${attribute(object.pgmid ?? 'R3TR')}" tm:type="${attribute(object.type)}" tm:name="${attribute(object.name)}"${optional}/>\n` +
    '  </tm:request>\n' +
    '</tm:root>'
  );
}

/**
 * Detach one object from a request or task — `useraction="removeobject"`.
 *
 * Addressed at the **task** that holds the object, not at the request above
 * it: that is what the capture did, and a request's objects live on its tasks.
 */
export async function removeObjectFromTransport(
  connection: IAbapConnection,
  transportNumber: string,
  object: IAbapObjectEntry,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: requestUrl(transportNumber),
    method: 'PUT',
    timeout: getTimeout('default'),
    data: userActionDocument(transportNumber, 'removeobject', object),
    headers: USER_ACTION_HEADERS,
  });
}

/**
 * Attach one object to a request or task — `useraction="addobject"`.
 *
 * Refused when the object is held by an unrelated task, with `SCTS_ADT_MSG
 * 009` and a longtext naming the task that holds it. That is a third lock
 * flavour, distinct from the enqueue lock and from the request-versus-task
 * one, and it is the server's answer to read rather than a state this client
 * checks for.
 */
export async function addObjectToTransport(
  connection: IAbapConnection,
  transportNumber: string,
  object: IAbapObjectEntry,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: requestUrl(transportNumber),
    method: 'PUT',
    timeout: getTimeout('default'),
    data: userActionDocument(transportNumber, 'addobject', object),
    headers: USER_ACTION_HEADERS,
  });
}

/**
 * Create a task under a request — `useraction="newtask"`.
 *
 * Answers 201 with the new number in `Location`, and the task is itself a
 * request resource at the same endpoint shape: it can be read, written to and
 * released like one.
 */
export async function createTransportTask(
  connection: IAbapConnection,
  transportNumber: string,
  targetUser?: string,
): Promise<IAdtWireResponse> {
  const user =
    targetUser === undefined ? '' : ` tm:targetuser="${attribute(targetUser)}"`;

  return connection.makeAdtRequest({
    url: `${requestUrl(transportNumber)}/tasks`,
    method: 'POST',
    timeout: getTimeout('default'),
    data:
      '<?xml version="1.0" encoding="ASCII"?>\n' +
      `<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="${attribute(transportNumber)}"${user} tm:useraction="newtask"/>`,
    headers: USER_ACTION_HEADERS,
  });
}

/**
 * The request's own account of what happened to it — `GET …/actionlogs`.
 *
 * One `log:entry` per lifecycle event: created, object added, object deleted,
 * owner changed. It is how a caller confirms that a `removeobject` landed,
 * since the action's own answer only echoes what was asked.
 */
export async function readTransportActionLog(
  connection: IAbapConnection,
  transportNumber: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${requestUrl(transportNumber)}/actionlogs`,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: 'application/vnd.sap.adt.logs+xml' },
  });
}
