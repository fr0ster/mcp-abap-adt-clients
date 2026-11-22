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
 * An entry whose name or type is missing is skipped rather than answered with
 * an empty string: nothing can be done with it, and a caller counting entries
 * should not count a hole.
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
import { tmAttribute, tmChildren, transportRoot } from './document';

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

/** An attribute as written; `undefined` when absent or empty. */
const text = (node: unknown, name: string): string | undefined => {
  const value = tmAttribute(node, name);
  return value === '' ? undefined : value;
};

/** One entry, read; `undefined` for one without a name or a type. */
function entryOf(
  entry: unknown,
  task: string | undefined,
): ITransportObjectEntry | undefined {
  const name = text(entry, 'name');
  const type = text(entry, 'type');
  if (name === undefined || type === undefined) return undefined;
  return {
    ...(task === undefined ? {} : { task }),
    name,
    type,
    pgmid: text(entry, 'pgmid'),
    description: text(entry, 'obj_desc'),
    // No `?? ''`: see the field's own note. An absent position is absent.
    position: text(entry, 'position'),
    lockStatus: text(entry, 'lock_status'),
    imageActivity: text(entry, 'img_activity'),
    info: text(entry, 'obj_info'),
  };
}

/** The entries `element` holds as its own children, each with `task`. */
function childEntries(
  element: unknown,
  task: string | undefined,
): ITransportObjectEntry[] {
  return tmChildren(element, 'abap_object').flatMap((entry) => {
    const read = entryOf(entry, task);
    return read === undefined ? [] : [read];
  });
}

/** One `tm:task` element's entries, each with the task's number. */
export function taskEntries(task: unknown): ITransportObjectEntry[] {
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
function documentEntries(root: ParsedElement): ITransportObjectEntry[] {
  if (tmAttribute(root, 'object_type') === 'T') {
    return tmChildren(root, 'task').flatMap(taskEntries);
  }
  const entries: ITransportObjectEntry[] = [];
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
 * Answers an empty list for a request that holds nothing, and for a document
 * that is not a transport one — there is no entry to report either way, and a
 * reading is not where a wire error is decided.
 */
export function parseObjectEntries(document: unknown): ITransportObjectEntry[] {
  const root = transportRoot(document);
  if (root === undefined) return [];
  return documentEntries(root);
}
