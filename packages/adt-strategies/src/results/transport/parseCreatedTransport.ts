/**
 * The document a create answers, read into the request it made.
 *
 * This lived inside `create.ts`, which parsed the response and returned an
 * object in place of the document — so a caller could never reach what the
 * server actually said, and the shipped reading had nothing left to read. The
 * parse is a reading, so it lives with the other readings and the writer hands
 * the document on untouched.
 */

import { tmAttribute, tmChildren, transportRoot } from './document';

/** What a created transport request is, as its own document names it. */
export interface ICreatedTransport {
  /** `tm:number` — the identifier everything else about the request needs. */
  transportNumber: string;
  /** `tm:desc`, as the server recorded it — which may differ from what was asked. */
  description: string | undefined;
  /** `tm:type` — `K` for workbench, `T` for customizing. */
  type: string | undefined;
  /** `tm:target` — the transport target, `LOCAL` when there is none. */
  targetSystem: string | undefined;
  /** `tm:target_desc` — the target's human name, which the target itself is not. */
  targetDescription: string | undefined;
  /** `tm:cts_project`, and its description where the system carries one. */
  ctsProject: string | undefined;
  ctsProjectDescription: string | undefined;
  /** `tm:uri` — the request's own address, to follow rather than assemble. */
  uri: string | undefined;
  /**
   * The request the created item is on: its `tm:parent`, or — for a task
   * whose number is on the root — the number of the `tm:request` beside it.
   */
  parent: string | undefined;
  /** The task's owner, falling back to the request's. */
  owner: string | undefined;
}

/** The words this reading refuses an answer with; nothing of the document. */
export const CREATED_TRANSPORT_REFUSAL =
  'parseCreatedTransport: the answer names no created transport request or task';

/**
 * Read a create response.
 *
 * **The created item is the root's own number.** A created TASK —
 * `useraction="newtask"`, answered `tm:useraction="tasks"` — carries its
 * number and its fields on the root itself:
 *
 * ```xml
 * <tm:root … tm:useraction="tasks" tm:number="DEVK907073"
 *            tm:uri="/sap/bc/adt/cts/transportrequests/DEVK907073"/>
 * ```
 *
 * and may name its request in a `tm:request` child, which is then its
 * `parent` — never the item created (until 0.28.0 a nested `tm:request` was
 * preferred, so such a task was reported as its parent). A created REQUEST
 * names no number on the root: its fields sit on `tm:request`, and that is
 * the item.
 *
 * Throws `CREATED_TRANSPORT_REFUSAL`, and nothing of the document, when the
 * answer is no `tm:root` document or names no number at all — answering an
 * empty number would report a transport that does not exist.
 */
export function parseCreatedTransport(document: unknown): ICreatedTransport {
  const root = transportRoot(document);
  if (root === undefined) throw new Error(CREATED_TRANSPORT_REFUSAL);
  const [request] = tmChildren(root, 'request');
  const rootNumber = tmAttribute(root, 'number');
  const ownNumber = rootNumber !== undefined && rootNumber !== '';
  const item = ownNumber ? root : request;
  const transportNumber = tmAttribute(item, 'number');
  if (transportNumber === undefined || transportNumber === '') {
    throw new Error(CREATED_TRANSPORT_REFUSAL);
  }
  const [task] = tmChildren(item, 'task');
  const requestNumber = tmAttribute(request, 'number');
  const declared = tmAttribute(item, 'parent');
  const parent =
    ownNumber &&
    (declared === undefined || declared === '') &&
    requestNumber !== undefined &&
    requestNumber !== '' &&
    requestNumber !== transportNumber
      ? requestNumber
      : declared;

  return {
    transportNumber,
    description: tmAttribute(item, 'desc') ?? tmAttribute(item, 'description'),
    type: tmAttribute(item, 'type'),
    targetSystem: tmAttribute(item, 'target'),
    targetDescription: tmAttribute(item, 'target_desc'),
    ctsProject: tmAttribute(item, 'cts_project'),
    ctsProjectDescription: tmAttribute(item, 'cts_project_desc'),
    uri: tmAttribute(item, 'uri'),
    parent,
    owner: tmAttribute(task, 'owner') ?? tmAttribute(item, 'owner'),
  };
}
