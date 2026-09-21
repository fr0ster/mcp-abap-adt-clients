/**
 * The object entries in a transport document, read into the shape the members
 * that take one already use.
 *
 * **Why this walks the document instead of addressing a path in it.** What was
 * measured on 2026-09-21 is that the organizer representation carries
 * `tm:abap_object` elements and that each one has a `tm:position` — the
 * numbers read out of them removed every entry they named. Where those
 * elements sit was not measured, and it is not the same everywhere: a request
 * holds its objects on its tasks, a task holds them directly, and the echo a
 * user action answers puts one under `tm:request`. Writing a path would be
 * inventing a tree from one example; walking for the element is reading what
 * the document says it has.
 *
 * An entry whose name or type is missing is skipped rather than answered with
 * an empty string: nothing can be done with it, and a caller counting entries
 * should not count a hole.
 */

import { XMLParser } from 'fast-xml-parser';
import type { IAbapObjectEntry } from './types';

/** What the objects reading answers by default. */
export interface ITransportObjectEntry extends IAbapObjectEntry {
  /** `tm:position` — present on every entry the organizer representation lists. */
  position: string;
  /** `tm:lock_status` and `tm:img_activity`, verbatim where the server sends them. */
  lockStatus?: string;
  imageActivity?: string;
}

const text = (value: unknown): string | undefined =>
  value === undefined || value === null || value === ''
    ? undefined
    : String(value);

/** Every `tm:abap_object` in the document, wherever it sits. */
function collect(node: unknown, found: unknown[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collect(child, found);
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'tm:abap_object' || key === 'abap_object') {
      if (Array.isArray(value)) found.push(...value);
      else found.push(value);
      continue;
    }
    collect(value, found);
  }
}

/**
 * Read a transport document into its object entries.
 *
 * Answers an empty list for a request that holds nothing, and for a document
 * that is not a transport one — there is no entry to report either way, and a
 * reading is not where a wire error is decided.
 */
export function parseObjectEntries(document: unknown): ITransportObjectEntry[] {
  const xml = typeof document === 'string' ? document : String(document ?? '');
  if (xml.trim() === '') return [];

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    // Positions are `000025`: parsed as a number they lose their width, and
    // the server is sent back the string it gave.
    parseAttributeValue: false,
  });

  const found: unknown[] = [];
  collect(parser.parse(xml), found);

  const entries: ITransportObjectEntry[] = [];
  for (const raw of found) {
    if (typeof raw !== 'object' || raw === null) continue;
    const entry = raw as Record<string, unknown>;
    const name = text(entry['tm:name'] ?? entry.name);
    const type = text(entry['tm:type'] ?? entry.type);
    if (name === undefined || type === undefined) continue;
    entries.push({
      name,
      type,
      pgmid: text(entry['tm:pgmid'] ?? entry.pgmid),
      description: text(entry['tm:obj_desc'] ?? entry.obj_desc),
      position: text(entry['tm:position'] ?? entry.position) ?? '',
      lockStatus: text(entry['tm:lock_status'] ?? entry.lock_status),
      imageActivity: text(entry['tm:img_activity'] ?? entry.img_activity),
    });
  }
  return entries;
}
