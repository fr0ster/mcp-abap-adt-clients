/**
 * The document `GET /sap/bc/adt/cts/transportrequests/{number}` answers, read
 * as the request or the task it describes.
 *
 * **SAP answers a task's number with the task's own document**
 * (`CL_CTS_ADT_TM_RES_REQUEST_CONT->fetch_request_data` →
 * `prepare_tm_root_for_task`, the same on premise and on the cloud): its root
 * is marked `tm:object_type="T"`, `tm:task` holds the task and its
 * `tm:abap_object` entries, and `tm:request` holds only the parent's header.
 * A request's document (`tm:object_type="R"`) holds the request in
 * `tm:request`, its tasks under it. Read as a request, a task's document
 * answered the parent — the defect this reading exists to end.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { rawOf } from '../../result';
import { tmAttribute, tmChildren, transportRoot } from './document';
import { type ITransportObjectEntry, taskEntries } from './parseObjectEntries';

/**
 * A request's or a task's header, each field the attribute as written (an
 * empty one `''`), `undefined` when the element does not carry it.
 */
export interface ITransportItemHeader {
  /** `tm:number`. */
  number: string;
  /** `tm:parent` — a task's request; `''` on a request. */
  parent: string | undefined;
  /** `tm:desc`. */
  description: string | undefined;
  /** `tm:type` — `K` or `W` on a request, the task type's text on a task. */
  type: string | undefined;
  /** `tm:status`, and `tm:status_text`, its words. */
  status: string | undefined;
  statusText: string | undefined;
  /** `tm:owner`. */
  owner: string | undefined;
  /** `tm:target`. */
  target: string | undefined;
  /** `tm:source_client`. */
  client: string | undefined;
  /** `tm:cts_project`. */
  ctsProject: string | undefined;
  /** `tm:lastchanged_timestamp`, as written (`YYYYMMDDhhmmss`). */
  lastChanged: string | undefined;
}

/** One task of a request: its header, and how many entries it holds. */
export interface ITransportTaskSummary {
  header: ITransportItemHeader;
  /** The task's `tm:abap_object` entries, counted. */
  objectCount: number;
}

/** A request's document, read. */
export interface ITransportRequestItem {
  kind: 'request';
  header: ITransportItemHeader;
  /** Its tasks, in document order. */
  tasks: ITransportTaskSummary[];
}

/** A task's document, read. */
export interface ITransportTaskItem {
  kind: 'task';
  header: ITransportItemHeader;
  /** The request the task is on: the header `tm:request` holds, when the document holds one. */
  parent: ITransportItemHeader | undefined;
  /** The task's entries, each with the task's number. */
  objects: ITransportObjectEntry[];
}

/** What a transport request or task document is, read. */
export type ITransportItem = ITransportRequestItem | ITransportTaskItem;

/** The words every refusal of this reading carries; nothing of the document. */
export const TRANSPORT_ITEM_REFUSAL =
  'readTransportItem: the answer is not the transport request or task asked for';

const refuse = (): never => {
  throw new Error(TRANSPORT_ITEM_REFUSAL);
};

function headerOf(element: unknown, number: string): ITransportItemHeader {
  return {
    number,
    parent: tmAttribute(element, 'parent'),
    description: tmAttribute(element, 'desc'),
    type: tmAttribute(element, 'type'),
    status: tmAttribute(element, 'status'),
    statusText: tmAttribute(element, 'status_text'),
    owner: tmAttribute(element, 'owner'),
    target: tmAttribute(element, 'target'),
    client: tmAttribute(element, 'source_client'),
    ctsProject: tmAttribute(element, 'cts_project'),
    lastChanged: tmAttribute(element, 'lastchanged_timestamp'),
  };
}

/** The element's number, which must be the one asked for. */
function numberOf(element: unknown, asked: string): string {
  const number = tmAttribute(element, 'number');
  return number !== undefined && number !== '' && number === asked
    ? number
    : refuse();
}

/** A header of an element whose number is not checked against the request: a parent's, a task's. */
function ownHeader(element: unknown): ITransportItemHeader | undefined {
  const number = tmAttribute(element, 'number');
  return number === undefined || number === ''
    ? undefined
    : headerOf(element, number);
}

/**
 * Read a transport request or task document, asked for by `number`.
 *
 * `kind` is the root's `tm:object_type` (`R` a request, `T` a task); without
 * it, a `tm:task` of the root naming `number` makes it a task, and anything
 * else a request. The element selected — the root's `tm:task` for a task,
 * its `tm:request` for a request — must name `number`.
 *
 * Throws `TRANSPORT_ITEM_REFUSAL`, and nothing of the document, for an answer
 * that is no `tm:root` document, whose marker is neither, or whose selected
 * element is missing, names no number or another one.
 */
export function readTransportItem(
  document: unknown,
  number: string,
): ITransportItem {
  const root = transportRoot(document) ?? refuse();
  const marker = tmAttribute(root, 'object_type');
  const tasks = tmChildren(root, 'task');
  const isTask =
    marker === 'T' ||
    (marker === undefined &&
      tasks.some((task) => tmAttribute(task, 'number') === number));
  if (marker !== undefined && marker !== 'T' && marker !== 'R') refuse();

  if (isTask) {
    const task =
      tasks.length === 1
        ? tasks[0]
        : tasks.find(
            (candidate) => tmAttribute(candidate, 'number') === number,
          );
    const header = headerOf(task, numberOf(task, number));
    const [request] = tmChildren(root, 'request');
    return {
      kind: 'task',
      header,
      parent: ownHeader(request),
      objects: taskEntries(task),
    };
  }

  const requests = tmChildren(root, 'request');
  const request = requests.length === 1 ? requests[0] : refuse();
  return {
    kind: 'request',
    header: headerOf(request, numberOf(request, number)),
    tasks: tmChildren(request, 'task').flatMap((task) => {
      const header = ownHeader(task);
      return header === undefined
        ? []
        : [{ header, objectCount: tmChildren(task, 'abap_object').length }];
    }),
  };
}

/**
 * `readTransportItem` as a result strategy, for the number asked for — the
 * document does not say what was asked, so the strategy is made per call:
 *
 * ```typescript
 * client.getRequest({ ...transportDocuments, objects: transportItem(number) })
 * ```
 */
export const transportItem =
  (number: string): IResultStrategy<ITransportItem> =>
  (answer) =>
    readTransportItem(rawOf(answer), number);
