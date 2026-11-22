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
import {
  type ITmElement,
  tmAttributeIn,
  tmElements,
  tmRootElement,
  transportRoot,
} from './document';
import {
  type ITransportObjectEntry,
  taskEntriesIn,
} from './parseObjectEntries';

/**
 * A request's or a task's header, each field the attribute decoded and
 * trimmed (since 0.28.1; an empty one `''`), `undefined` when the element
 * does not carry it. A `tm:`-qualified attribute wins over a bare one.
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

/** Every header field of an element, by the tm namespace, each decoded and trimmed. */
function headerOf(tm: ITmElement, number: string): ITransportItemHeader {
  const field = (local: string): string | undefined => tmAttributeIn(tm, local);
  return {
    number,
    parent: field('parent'),
    description: field('desc'),
    type: field('type'),
    status: field('status'),
    statusText: field('status_text'),
    owner: field('owner'),
    target: field('target'),
    client: field('source_client'),
    ctsProject: field('cts_project'),
    lastChanged: field('lastchanged_timestamp'),
  };
}

/** A header of an element whose number is not checked against the request: a parent's, a task's. */
function ownHeader(
  tm: ITmElement | undefined,
): ITransportItemHeader | undefined {
  if (tm === undefined) return undefined;
  const number = tmAttributeIn(tm, 'number');
  return number === undefined || number === ''
    ? undefined
    : headerOf(tm, number);
}

/** The elements among `elements` whose own `tm:number`, trimmed, is `asked`. */
const naming = (elements: ITmElement[], asked: string): ITmElement[] =>
  elements.filter((tm) => tmAttributeIn(tm, 'number') === asked);

/**
 * Read a transport request or task document, asked for by `number`.
 *
 * **The number asked decides the item** (since 0.28.1): the root's `tm:task`
 * whose own number is `number` makes it a task, the root's `tm:request` whose
 * own number is `number` a request; exactly one element may name it. The
 * root's `tm:object_type` (`R` a request, `T` a task) must confirm what the
 * number found.
 *
 * Without the marker the number decides alone, with one rule of the
 * document's shape: a root that holds a `tm:task` of its own is a task's
 * document, whose `tm:request` is only the parent's header, so it is not the
 * request asked for. SAP marks every task document
 * (`CL_CTS_ADT_TM_RES_REQUEST_CONT->prepare_tm_root_for_task`, on premise and
 * on the cloud), so the markerless case is defensive: until 0.28.1 a task's
 * unmarked document asked for by its parent's number was read as the parent.
 *
 * Throws `TRANSPORT_ITEM_REFUSAL`, and nothing of the document, for an answer
 * that is no `tm:root` document, whose marker is neither or contradicts the
 * element found, where no element or more than one names `number`, or where
 * the number is blank.
 */
export function readTransportItem(
  document: unknown,
  number: string,
): ITransportItem {
  const root = tmRootElement(transportRoot(document) ?? refuse());
  const marker = tmAttributeIn(root, 'object_type');
  if (marker !== undefined && marker !== 'T' && marker !== 'R') refuse();
  const asked = number.trim();
  if (asked === '') refuse();

  const rootTasks = tmElements(root, 'task');
  const requests = tmElements(root, 'request');
  const tasksNamed = naming(rootTasks, asked);
  const requestsNamed = naming(requests, asked);
  if (tasksNamed.length + requestsNamed.length !== 1) refuse();

  const [task] = tasksNamed;
  if (task !== undefined) {
    if (marker === 'R') refuse();
    const [request] = requests;
    return {
      kind: 'task',
      header: headerOf(task, asked),
      parent: ownHeader(request),
      objects: taskEntriesIn(task),
    };
  }

  const [request] = requestsNamed;
  if (request === undefined || marker === 'T') return refuse();
  if (marker === undefined && rootTasks.length > 0) refuse();
  return {
    kind: 'request',
    header: headerOf(request, asked),
    tasks: tmElements(request, 'task').flatMap((child) => {
      const header = ownHeader(child);
      return header === undefined
        ? []
        : [{ header, objectCount: tmElements(child, 'abap_object').length }];
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
