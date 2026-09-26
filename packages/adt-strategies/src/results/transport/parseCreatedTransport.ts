/**
 * The document a create answers, read into the request it made.
 *
 * This lived inside `create.ts`, which parsed the response and returned an
 * object in place of the document — so a caller could never reach what the
 * server actually said, and the shipped reading had nothing left to read. The
 * parse is a reading, so it lives with the other readings and the writer hands
 * the document on untouched.
 */

import { XMLParser } from 'fast-xml-parser';

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
  /** `tm:parent`, for a request created under another. */
  parent: string | undefined;
  /** The task's owner, falling back to the request's. */
  owner: string | undefined;
}

/**
 * Read a create response.
 *
 * Throws when the document is not a transport response at all — that is not a
 * shape this can guess at, and answering an empty request would report a
 * transport that does not exist.
 */
export function parseCreatedTransport(document: unknown): ICreatedTransport {
  const xml = typeof document === 'string' ? document : String(document ?? '');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
  });

  const root = parser.parse(xml)['tm:root'] ?? parser.parse(xml).root;
  if (!root) {
    throw new Error(
      'Invalid transport response XML structure - no tm:root found',
    );
  }

  /**
   * **Two shapes answer this reading, and the fields sit at different
   * depths.** A created REQUEST carries them on `tm:request` inside the root;
   * a created TASK — `useraction="newtask"` — carries them on the root
   * itself, which has no `tm:request` at all:
   *
   * ```xml
   * <tm:root … tm:useraction="tasks" tm:number="E19K907073"
   *            tm:uri="/sap/bc/adt/cts/transportrequests/E19K907073"/>
   * ```
   *
   * Read from `tm:request` alone this answered `transportNumber: ''` for
   * every task ever created — a number nothing can be done with, handed back
   * as a success. So the root stands in where the request element is absent,
   * and a request document is read exactly as before: its root carries none
   * of these attributes, so the fallback never fires for one.
   */
  const request = root['tm:request'] ?? root;
  const task = request['tm:task'] ?? {};
  const text = (value: unknown): string | undefined =>
    value === undefined || value === null ? undefined : String(value);

  return {
    transportNumber: String(request['tm:number'] ?? ''),
    description: text(request['tm:desc'] ?? request['tm:description']),
    type: text(request['tm:type']),
    targetSystem: text(request['tm:target']),
    targetDescription: text(request['tm:target_desc']),
    ctsProject: text(request['tm:cts_project']),
    ctsProjectDescription: text(request['tm:cts_project_desc']),
    uri: text(request['tm:uri']),
    parent: text(request['tm:parent']),
    owner: text(task['tm:owner'] ?? request['tm:owner']),
  };
}
