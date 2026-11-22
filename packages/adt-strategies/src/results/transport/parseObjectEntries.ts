/**
 * The object entries in a transport document, read into the shape the members
 * that take one already use.
 *
 * **Entries are read per task.** What was measured on 2026-09-21 is that the
 * organizer representation carries `tm:abap_object` elements and that each
 * one has a `tm:position` — the numbers read out of them removed every entry
 * they named. A request's document holds them on its tasks
 * (`tm:request/tm:task`) and once more in `tm:all_objects`, its aggregate; a
 * task's document (`tm:object_type="T"`) holds them on `tm:root/tm:task`,
 * beside the parent's header in `tm:request` (`CL_CTS_ADT_TM_RES_REQUEST_CONT
 * ->prepare_tm_root_for_task`). Until 0.28.0 every `tm:abap_object` was
 * collected wherever it sat, so a request's entries came twice and none said
 * which task it was on; each now comes once, with its task's number.
 *
 * **An entry whose name or type is missing is kept apart** (since 0.28.2;
 * until then it was skipped). It is not answered among the entries, whose
 * `name` and `type` stay required — an empty string would let it pass for an
 * object — but in `incompleteEntries` (`ITransportIncompleteEntry`), with
 * every field it carries and the ones it lacks absent. SAP listed it, so a
 * caller counting what a task holds counts it too.
 *
 * An entry whose *position* is missing is kept, because it still says the
 * request holds that object — which is a true and useful thing to report — and
 * its `position` is left undefined rather than blanked. `removeObject`
 * requires one, so the compiler stops that entry being passed to it without
 * the caller deciding what to do; an empty string would have passed the type
 * and removed nothing.
 */

import type { IAbapObjectEntry } from '@mcp-abap-adt/interfaces-adt';
import { isElement, listOf, type ParsedElement } from '../../parsed';
import {
  type ITmElement,
  tmAttribute,
  tmAttributeIn,
  tmChildren,
  tmElements,
  transportRoot,
} from './document';

/** What the objects reading answers by default. */
export interface ITransportObjectEntry extends IAbapObjectEntry {
  /**
   * `tm:position` — the value `removeObject` needs, and **optional here on
   * purpose**.
   *
   * Every entry measured carried one, so this is close to always present. But
   * it was declared required and filled with `''` when the attribute was
   * missing, and that is the one shape this member must never produce: `''`
   * satisfies `removeObject`'s `position: string`, so the call compiles,
   * reaches the server and removes nothing while answering `200` — the exact
   * defect these members exist to end, re-created by the reading meant to
   * prevent it.
   *
   * Left optional, an entry the server described without a position cannot be
   * spread into `removeObject` at all: the compiler asks the caller what to do
   * about it. Nothing is invented and nothing is hidden.
   */
  position?: string;
  /** `tm:lock_status` and `tm:img_activity`, verbatim where the server sends them. */
  lockStatus?: string;
  imageActivity?: string;
  /**
   * Since 0.28.0: the number of the task the entry is on
   * (`tm:task/@tm:number`); absent when the entry is on no task (an echo's
   * entry under `tm:request`) or its task names none.
   */
  task?: string;
  /** Since 0.28.0: `tm:obj_info` — the entry's kind in words, where the server sends it. */
  info?: string;
}

/**
 * An entry SAP lists without its `tm:name` or `tm:type` (since 0.28.2): every
 * field `ITransportObjectEntry` has, each present only when the entry carries
 * it. Until 0.28.2 such an entry was dropped.
 */
export type ITransportIncompleteEntry = Omit<
  ITransportObjectEntry,
  'name' | 'type'
> & {
  name?: string;
  type?: string;
};

/**
 * What `parseObjectEntryList` answers (since 0.28.2): the entries, and each
 * entry SAP lists without a name or a type in `incompleteEntries`, in
 * document order, present only when the document holds one. A plain object,
 * so a copy or JSON of it keeps both.
 */
export interface ITransportObjectEntryList {
  entries: ITransportObjectEntry[];
  incompleteEntries?: ITransportIncompleteEntry[];
}

/**
 * One `tm:abap_object` read: an entry, or an entry missing a required field.
 * `legacy` is what `parseObjectEntries` answered for an entry whose name or
 * type is blank only after trimming (`&#32;`): its array keeps answering it
 * as before, while the complete readings count it as missing the field.
 */
type ReadEntry =
  | { complete: ITransportObjectEntry }
  | {
      incomplete: ITransportIncompleteEntry;
      legacy: ITransportObjectEntry | undefined;
    };

/** The entries read, split into the complete and the incomplete, each in document order. */
interface ISplitEntries {
  entries: ITransportObjectEntry[];
  incompleteEntries: ITransportIncompleteEntry[];
}

const split = (read: ReadEntry[]): ISplitEntries => {
  const entries: ITransportObjectEntry[] = [];
  const incompleteEntries: ITransportIncompleteEntry[] = [];
  for (const entry of read) {
    if ('complete' in entry) entries.push(entry.complete);
    else incompleteEntries.push(entry.incomplete);
  }
  return { entries, incompleteEntries };
};

/** Reads an element's attribute by its local name, as written. */
type AttributeOf = (name: string) => string | undefined;

/** An attribute as written; `undefined` when absent or empty. */
const nonEmpty = (value: string | undefined): string | undefined =>
  value === '' ? undefined : value;

/** An attribute as written; `undefined` when absent or blank once trimmed. */
const nonBlank = (value: string | undefined): string | undefined =>
  value === undefined || value.trim() === '' ? undefined : value;

const text = (node: unknown, name: string): string | undefined =>
  nonEmpty(tmAttribute(node, name));

/**
 * One entry, read through `attribute`: complete when it carries a name and a
 * type, neither blank once decoded and trimmed; else incomplete, with only
 * the fields it carries (a blank name or type absent).
 */
function entryOf(attribute: AttributeOf, task: string | undefined): ReadEntry {
  const read = (name: string): string | undefined => nonEmpty(attribute(name));
  const name = read('name');
  const type = read('type');
  const fields = {
    pgmid: read('pgmid'),
    description: read('obj_desc'),
    // No `?? ''`: see the field's own note. An absent position is absent.
    position: read('position'),
    lockStatus: read('lock_status'),
    imageActivity: read('img_activity'),
    info: read('obj_info'),
  };
  const asEntry = (
    entryName: string,
    entryType: string,
  ): ITransportObjectEntry => ({
    ...(task === undefined ? {} : { task }),
    name: entryName,
    type: entryType,
    ...fields,
  });
  // A name or a type blank once decoded and trimmed is missing (0.28.2).
  const ownName = nonBlank(name);
  const ownType = nonBlank(type);
  if (ownName !== undefined && ownType !== undefined) {
    return { complete: asEntry(ownName, ownType) };
  }
  const legacy =
    name !== undefined && type !== undefined ? asEntry(name, type) : undefined;
  // Only the fields the entry carries: an absent one is no key at all.
  const present = (
    key: keyof ITransportIncompleteEntry,
    value: string | undefined,
  ): Partial<Record<keyof ITransportIncompleteEntry, string>> =>
    value === undefined ? {} : { [key]: value };
  const incomplete: ITransportIncompleteEntry = {
    ...present('task', task),
    ...present('name', ownName),
    ...present('type', ownType),
    ...present('pgmid', fields.pgmid),
    ...present('description', fields.description),
    ...present('position', fields.position),
    ...present('lockStatus', fields.lockStatus),
    ...present('imageActivity', fields.imageActivity),
    ...present('info', fields.info),
  };
  return { incomplete, legacy };
}

/** The entries `element` holds as its own children, each with `task`. */
function childEntries(element: unknown, task: string | undefined): ReadEntry[] {
  return tmChildren(element, 'abap_object').map((entry) =>
    entryOf((name) => tmAttribute(entry, name), task),
  );
}

/**
 * A task's entries read by namespace (`readTransportItem`, since 0.28.1):
 * every `abap_object` child and its attributes by the tm namespace URI and
 * local name, whatever the prefix. Since 0.28.2 an entry without a name or a
 * type is in `incompleteEntries`, not dropped.
 */
export function taskEntriesIn(task: ITmElement): ISplitEntries {
  const number = nonEmpty(tmAttributeIn(task, 'number'));
  return split(
    tmElements(task, 'abap_object').map((entry) =>
      entryOf((name) => tmAttributeIn(entry, name), number),
    ),
  );
}

/** One `tm:task` element's entries, each with the task's number. */
function taskEntries(task: unknown): ReadEntry[] {
  return childEntries(task, text(task, 'number'));
}

/**
 * The entries of a document, in document order: every `tm:task` reached from
 * the root gives its own, with its number — a task document's
 * (`tm:root/tm:task`), a request document's (`tm:root/tm:request/tm:task`);
 * a `tm:request` gives the entries it holds as its own children, on no task
 * (the `removeobject` echo, recorded, puts its entry there). The entries of
 * `tm:all_objects`, a request's aggregate of its tasks' entries, sit on no
 * task and no request, so none is read twice.
 */
function documentEntries(root: ParsedElement): ReadEntry[] {
  if (tmAttribute(root, 'object_type') === 'T') {
    return tmChildren(root, 'task').flatMap(taskEntries);
  }
  const entries: ReadEntry[] = [];
  const walk = (node: unknown): void => {
    for (const element of listOf(node)) {
      if (!isElement(element)) continue;
      for (const [key, value] of Object.entries(element)) {
        if (key.startsWith('@_')) continue;
        if (key === 'tm:task' || key === 'task') {
          entries.push(...listOf(value).flatMap(taskEntries));
        } else if (key === 'tm:request' || key === 'request') {
          for (const request of listOf(value)) {
            entries.push(...childEntries(request, undefined));
            walk(request);
          }
        } else if (key !== 'tm:abap_object' && key !== 'abap_object') {
          walk(value);
        }
      }
    }
  };
  walk(root);
  return entries;
}

/**
 * Read a transport document into its object entries: per task, in document
 * order, each with the number of the task it is on (an echo's entry directly
 * under `tm:request` has none). A request's `tm:all_objects` repeats its
 * tasks' entries and is not read, so every entry comes once.
 *
 * **This array leaves out an entry without a name or a type**, as it always
 * has; `parseObjectEntryList` (since 0.28.2) is the complete reading, which
 * answers such an entry in `incompleteEntries`.
 *
 * Answers an empty list for a request that holds nothing, and for a document
 * that is not a transport one — there is no entry to report either way, and a
 * reading is not where a wire error is decided.
 */
export function parseObjectEntries(document: unknown): ITransportObjectEntry[] {
  const root = transportRoot(document);
  if (root === undefined) return [];
  return documentEntries(root).flatMap((entry) => {
    if ('complete' in entry) return [entry.complete];
    return entry.legacy === undefined ? [] : [entry.legacy];
  });
}

/**
 * The complete reading of a transport document's entries (since 0.28.2):
 * `entries`, and each entry SAP lists without a name or a type — absent,
 * empty, or blank once decoded and trimmed — in `incompleteEntries`,
 * present only when the document holds one. `entries` are the ones
 * `parseObjectEntries` answers, less those with a blank name or type. A task holds `entries.length +
 * (incompleteEntries?.length ?? 0)` entries.
 */
export function parseObjectEntryList(
  document: unknown,
): ITransportObjectEntryList {
  const root = transportRoot(document);
  if (root === undefined) return { entries: [] };
  const { entries, incompleteEntries } = split(documentEntries(root));
  return incompleteEntries.length === 0
    ? { entries }
    : { entries, incompleteEntries };
}
