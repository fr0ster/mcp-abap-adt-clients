/**
 * Reading the HTML SAP renders a gateway error in — the `atom:summary`
 * (`type="html"`) of each `gw/errorlog` entry and the error's own document.
 *
 * Measured on the cloud (2026-11-22, 115 entries and one error's document):
 * an error is rendered as sections, each an `<h4 id="…">` followed by one
 * `<table>` — `HEADER_INFO` (on premise `HEADER`, measured 2026-11-25) and
 * `SERVICE` (two cells a row: a `<b>` label and its value; on premise the
 * label written after two `&nbsp;`), `SOURCE` (line numbers, then the lines),
 * `STACK` (a header row
 * of `<th>`, then one row a call) and `CONTEXT` (a tree, its depth written as
 * leading `&nbsp;` in the label, a node marked `&ndash;`). The error's own
 * document is that HTML alone, not XML.
 *
 * Plain linear string code — no regular expression, no HTML parser: the
 * fragments are SAP's fixed rendering, read by the tags it writes.
 */

import { decodeReferences } from '../parsed';

const NAMED_ENTITIES: ReadonlyMap<string, string> = new Map([
  ['amp', '&'],
  ['lt', '<'],
  ['gt', '>'],
  ['quot', '"'],
  ['apos', "'"],
  ['nbsp', '\u00a0'],
  ['ndash', '\u2013'],
  ['mdash', '\u2014'],
]);

const DECIMAL = '0123456789';
const HEX = '0123456789abcdefABCDEF';

function allOf(text: string, digits: string): boolean {
  if (text === '') return false;
  for (const character of text) if (!digits.includes(character)) return false;
  return true;
}

function entity(name: string): string | undefined {
  const named = NAMED_ENTITIES.get(name);
  if (named !== undefined) return named;
  if (!name.startsWith('#')) return undefined;
  const hex = name.startsWith('#x') || name.startsWith('#X');
  const digits = name.slice(hex ? 2 : 1);
  if (!allOf(digits, hex ? HEX : DECIMAL)) return undefined;
  const code = Number.parseInt(digits, hex ? 16 : 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : undefined;
}

/**
 * HTML text with its entities decoded, in one pass: the XML five, `&nbsp;`
 * (U+00A0), `&ndash;`, `&mdash;` — the named ones SAP writes here — and every
 * character reference. An entity not known stays as written.
 */
export function decodeHtml(text: string): string {
  return decodeReferences(text, entity);
}

/** A fragment's text: every tag removed, entities decoded, nothing trimmed. */
export function htmlText(fragment: string): string {
  let text = '';
  let from = 0;
  for (;;) {
    const open = fragment.indexOf('<', from);
    if (open < 0) break;
    text += fragment.slice(from, open);
    const close = fragment.indexOf('>', open + 1);
    if (close < 0) {
      from = fragment.length;
      break;
    }
    from = close + 1;
  }
  return decodeHtml(text + fragment.slice(from));
}

/** A cell's text, trimmed (U+00A0 included); `undefined` when nothing is left. */
export function cellText(fragment: string): string | undefined {
  const text = htmlText(fragment).trim();
  return text === '' ? undefined : text;
}

/** The inner HTML of every `<tag …>…</tag>` in a fragment, in order (not nested). */
export function elementsOf(fragment: string, tag: string): string[] {
  const found: string[] = [];
  let from = 0;
  for (;;) {
    let open = fragment.indexOf(`<${tag}`, from);
    // `<tr` must not match `<track`, `<td` not `<tdx`: the next is `>` or a space.
    while (open >= 0) {
      const next = fragment[open + tag.length + 1];
      if (next === '>' || next === ' ') break;
      open = fragment.indexOf(`<${tag}`, open + 1);
    }
    if (open < 0) break;
    const start = fragment.indexOf('>', open);
    if (start < 0) break;
    const end = fragment.indexOf(`</${tag}>`, start);
    if (end < 0) break;
    found.push(fragment.slice(start + 1, end));
    from = end + tag.length + 3;
  }
  return found;
}

/** The `<table>` that follows the heading `<h4 id="{id}">`; `undefined` when there is none. */
export function sectionTable(html: string, id: string): string | undefined {
  const heading = html.indexOf(`<h4 id="${id}"`);
  if (heading < 0) return undefined;
  const open = html.indexOf('<table', heading);
  if (open < 0) return undefined;
  const next = html.indexOf('<h4', heading + 1);
  if (next >= 0 && next < open) return undefined;
  const end = html.indexOf('</table>', open);
  return end < 0 ? undefined : html.slice(open, end + 8);
}

/** A table's rows, each the inner HTML of its cells (`<td>` or `<th>`). */
export function tableRows(table: string): string[][] {
  return elementsOf(table, 'tr').map((row) => {
    const cells = elementsOf(row, 'td');
    return cells.length > 0 ? cells : elementsOf(row, 'th');
  });
}

/**
 * A two-cell table — `<b>label</b>` and value — as a map from label (trimmed)
 * to the value's inner HTML.
 */
export function labelledRows(table: string | undefined): Map<string, string> {
  const rows = new Map<string, string>();
  if (table === undefined) return rows;
  for (const [label, value] of tableRows(table)) {
    if (label === undefined || value === undefined) continue;
    const name = cellText(label);
    if (name !== undefined && !rows.has(name)) rows.set(name, value);
  }
  return rows;
}

/** One node of the `CONTEXT` tree: its label, its value, and what is under it. */
export interface IGatewayContextNode {
  label: string;
  value?: string;
  children: IGatewayContextNode[];
}

/**
 * The `CONTEXT` table as a tree. A label marked `\u2013` (`&ndash;`) is a
 * node; its level is its leading U+00A0 count. A leaf (an unmarked label) is
 * written five U+00A0 deeper than the node it belongs to, a node one deeper
 * (measured: `ERROR_CONTEXT` at 1, its `ERROR_INFO` at 6 and `Exceptions` at
 * 2; an exception at 3, its `Text` at 8 and `Attributes` at 4, whose leaves
 * are at 9), so a leaf's level is its count less four. A row is the child of
 * the nearest row above of a smaller level.
 */
export function contextTree(table: string | undefined): IGatewayContextNode[] {
  const roots: IGatewayContextNode[] = [];
  if (table === undefined) return roots;
  const stack: { level: number; node: IGatewayContextNode }[] = [];
  for (const [labelCell, valueCell] of tableRows(table)) {
    if (labelCell === undefined) continue;
    const raw = htmlText(labelCell);
    let depth = 0;
    while (depth < raw.length && raw[depth] === '\u00a0') depth += 1;
    let label = raw.slice(depth);
    const isNode = label.startsWith('\u2013');
    if (isNode) label = label.slice(1);
    label = label.trim();
    if (label === '') continue;
    const level = isNode ? depth : Math.max(depth - 4, 0);
    const value = valueCell === undefined ? undefined : cellText(valueCell);
    const node: IGatewayContextNode =
      value === undefined
        ? { label, children: [] }
        : { label, value, children: [] };
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      if (top !== undefined && top.level < level) break;
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    if (parent === undefined) roots.push(node);
    else parent.node.children.push(node);
    stack.push({ level, node });
  }
  return roots;
}

/** The first node of that label, anywhere in the tree, depth first. */
export function findNode(
  nodes: readonly IGatewayContextNode[],
  label: string,
): IGatewayContextNode | undefined {
  for (const node of nodes) {
    if (node.label === label) return node;
    const below = findNode(node.children, label);
    if (below !== undefined) return below;
  }
  return undefined;
}
