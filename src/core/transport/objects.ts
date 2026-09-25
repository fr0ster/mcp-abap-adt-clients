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
  AdtTaskType,
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt';
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
 * `tm:position` and `tm:obj_desc` are written only when given. `obj_desc` is
 * decoration; `tm:position` is not, and {@link removeObjectFromTransport} says
 * why it now insists on one.
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
 *
 * **`object.position` is what identifies the entry, and without it the server
 * does nothing while saying it did.** Measured against an on-premise system,
 * 2026-09-21: 22 objects were removed from one task by `pgmid`/`type`/`name`
 * alone. All 22 answered `200` with the usual echo document — and all 22 were
 * still on the task afterwards. Adding `tm:position` and nothing else
 * made every one of them land, confirmed by re-reading the task after each
 * call (22 → 0). The number comes from the task's own listing, as
 * `tm:position` on the `tm:abap_object` being removed.
 *
 * This is why the member's answer is not evidence: a `200` here means the
 * request was understood, not that an entry went away. `readTransportActionLog`
 * — or a re-read of the task — is the confirmation.
 */
export async function removeObjectFromTransport(
  connection: IAbapConnection,
  transportNumber: string,
  object: IAbapObjectEntry & { position: string },
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
 *
 * On an on-premise system, 2026-09-25, the same `SCTS_ADT_MSG 009` also
 * arrived, with longtext TK127, when the target was Unclassified — including
 * a task created explicitly through `newtask`. Classify it first through
 * {@link changeTransportTaskType}.
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
 * Answers 200 with the new number both in `Location` and as `tm:number` on the
 * root, and the task is itself a request resource at the same endpoint shape:
 * it can be read, written to and released like one.
 *
 * **`targetUser` is required, and that is measured.** It was optional when
 * this shipped, on the reasoning that the server would decide whose task it is
 * when the attribute was absent. It does not. Omitting `tm:targetuser` was
 * sent to an on-premise system, 2026-09-21, and answered:
 *
 * ```
 * 400  SCTS_ADT_MSG 009
 * User  does not exist in the system (or locked)
 * ```
 *
 * — two spaces after `User`, because the name it resolved was empty. The same
 * call carrying `tm:targetuser` answered 200 with a task number. Eclipse sends
 * the attribute on every `newtask`, which is why no capture showed the gap.
 *
 * Nothing here defaults it: `IAbapConnection` does not expose who is
 * authenticated, and finding out would cost a second request — which is the
 * one thing a member of this library does not do.
 */
export async function createTransportTask(
  connection: IAbapConnection,
  transportNumber: string,
  targetUser: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${requestUrl(transportNumber)}/tasks`,
    method: 'POST',
    timeout: getTimeout('default'),
    data:
      '<?xml version="1.0" encoding="ASCII"?>\n' +
      `<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="${attribute(transportNumber)}" tm:targetuser="${attribute(targetUser)}" tm:useraction="newtask"/>`,
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

/**
 * The objects a request or task holds — the reading `removeObject` needs.
 *
 * **It exists for the parsing, not for the representation.**
 * `removeObjectFromTransport` requires a `tm:position`, and nothing else here
 * hands one back as a value — a caller would be digging it out of XML by
 * regex, which is the layering this member prevents.
 *
 * It asks for `application/vnd.sap.adt.transportorganizer.v1+xml`, and that
 * is what the endpoint answers anyway. This comment used to say the header is
 * what makes the entries appear — that `getTransport`, sending no `Accept`,
 * gets a representation without `tm:abap_object`. Measured against an
 * on-premise system, 2026-09-21: the same URL with the header and without it,
 * 95411 bytes and 166 `tm:abap_object` for a request, 55549 and 88 for a
 * task, byte for byte identical. The header settles nothing here; sending it
 * is simply naming what this member wants.
 */
export async function readTransportObjects(
  connection: IAbapConnection,
  transportNumber: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: requestUrl(transportNumber),
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_TRANSPORT },
  });
}

/**
 * Give a task its type — `useraction="changetasktype"`.
 *
 * **A task is born without one.** Measured against BTP ABAP, 2026-09-23:
 * every task on that system read back as `Unclassified`, including ones
 * created before this library existed, and passing `tm:type` on the creating
 * call changes nothing — the attribute is accepted and ignored. Why the tasks
 * CTS created there read that way too is not established.
 *
 * **The creation path matters.** When locking an object starts the normal CTS
 * flow and the user chooses to create a request, CTS creates both the request
 * and its task and classifies that task correctly. It can likewise classify
 * an existing Unclassified task selected in that flow. The direct `addobject`
 * action here is not that flow. On an on-premise system, 2026-09-25,
 * `addobject` onto a task made through `newtask` was refused with
 * `400 SCTS_ADT_MSG 009` / TK127 — *"Changes to objects are only allowed in
 * correction/repair"*. The same call answered 200 once
 * {@link changeTransportTaskType} had given the task type `S`. A caller that
 * intends to add objects directly must therefore classify the task first.
 *
 * **The document nests, and that is the whole of the difficulty.** The type
 * goes on a `tm:task` child, not on the root: six attribute spellings on the
 * root were each answered
 *
 *     400  Specified request type or task type  is unknown
 *
 * with two spaces where the value belongs — the endpoint read an empty one
 * every time. The shape below answers 200, and a re-read shows the new type.
 * The same message NAMES the value when one arrives (`… type K is unknown`),
 * which is what confirmed the empty reading rather than a wrong one.
 *
 * Measured vocabulary, same run:
 *
 *   S → Development/Correction
 *   R → Repair
 *   X → Unclassified, the state a task starts in
 *   Q → refused: "You can only change the type of tasks in workbench
 *       requests" — a customizing type, valid but not here
 *   K, W → refused as unknown: those are REQUEST types, not task ones
 *
 * Addressed at the task's own URL, which is where the listing puts the
 * `changetasktype` link — on the task element, never on the request above it.
 */
export async function changeTransportTaskType(
  connection: IAbapConnection,
  taskNumber: string,
  type: AdtTaskType,
): Promise<IAdtWireResponse> {
  const number = attribute(taskNumber);
  return connection.makeAdtRequest({
    url: requestUrl(taskNumber),
    method: 'PUT',
    timeout: getTimeout('default'),
    data:
      '<?xml version="1.0" encoding="ASCII"?>\n' +
      `<tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" tm:number="${number}" tm:useraction="changetasktype">` +
      `<tm:task tm:number="${number}" tm:type="${attribute(type)}"/>` +
      '</tm:root>',
    headers: USER_ACTION_HEADERS,
  });
}
