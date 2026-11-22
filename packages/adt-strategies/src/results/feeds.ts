/**
 * The Atom feeds `/sap/bc/adt/feeds` answers, read into entries.
 *
 * Moved from adt-clients, where these were the defaults of `FeedRepository` —
 * every member parsed its feed before a caller saw it. The members answer the
 * document as it came now; a caller who wants the entries passes these in the
 * result set it constructs the repository with:
 *
 * ```typescript
 * new FeedRepository(connection, {
 *   logger,
 *   results: { ...feedDocuments, feeds: feedDescriptors, entries: feedEntries },
 * });
 * ```
 *
 * The shapes are measured, not designed. A body with no entries — or none at
 * all — reads as `[]`; whether that is a failure is the caller's `analyse`.
 */

import type {
  IAbapTimestamp,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import {
  at,
  field,
  isElement,
  leafText,
  listOf,
  ownText,
  parsedText,
  XML_TEXT_OPTIONS,
} from '../parsed';
import { rawOf } from '../result';
import {
  cellText,
  contextTree,
  elementsOf,
  findNode,
  firstHref,
  htmlText,
  type IGatewayContextNode,
  labelledRows,
  sectionTable,
  tableRows,
} from './gatewayHtml';

export interface IFeedEntry {
  id: string;
  title: string;
  updated: IAbapTimestamp;
  link: string;
  content: string;
  author?: string;
  category?: string;
}

export interface IFeedDescriptor {
  id: string;
  title: string;
  url: string;
  category?: string;
}

export interface IFeedVariant {
  id: string;
  title: string;
  url: string;
}

// --- System message types ---

export interface ISystemMessageEntry {
  id: string;
  title: string;
  text: string;
  severity: string;
  validFrom: IAbapTimestamp;
  validTo: IAbapTimestamp;
  createdBy: string;
}

// --- Gateway error types ---

/**
 * One entry of `gw/errorlog`, read.
 *
 * **Measured on the cloud, 2026-11-22 (115 entries):** an entry holds
 * `atom:id`, `atom:title`, `atom:updated`, `atom:author/atom:name` and an
 * `atom:summary type="html"` — no category, no link, no extension element.
 * Everything else is a cell of the summary's `Header Information` table, read
 * by its label (`gatewayHtml.ts`). Every field is absent when the entry does
 * not carry it, never `''` (until 0.28.0 each was a string, and all but
 * `shortText`, `dateTime` and `username` read `''`).
 */
export interface IGatewayErrorEntry {
  /** `atom:id` — `{Type without the space}/{errorId}/{timestamp}`. */
  id?: string;
  /** The title's prefix before `: ` — `Frontend Error`, `Backend Error`. */
  kind?: string;
  /** The `Type` cell. */
  type?: string;
  /** The `Short Text` cell; the title without its prefix when there is none. */
  shortText?: string;
  /** The `Transaction ID` cell (until 0.28.0 this was the `atom:id`). */
  transactionId?: string;
  /** The `Package` cell. */
  package?: string;
  /** The `Application Component` cell. */
  applicationComponent?: string;
  /**
   * `atom:updated` for a list entry; for an error's own document, the
   * `Date/Time` cell as written (`11/22/2026 15:37:36 (System)`).
   */
  dateTime?: IAbapTimestamp;
  /** The user's name: the `Username` cell before ` (` (until 0.28.0, `name (id)`). */
  username?: string;
  /** What the `Username` cell names in parentheses after the name. */
  userId?: string;
  /** The `Client` cell. */
  client?: string;
  /** The `Request Kind` cell. */
  requestKind?: string;
  /**
   * The error's own document, as a path — the summary's `HTTP link`, from
   * `/sap/bc/adt/` on. Its last segment is `errorId`, not `transactionId`.
   */
  detailUri?: string;
  /** The error's id in `detailUri` — what `getGatewayError(type, id)` takes. */
  errorId?: string;
}

/**
 * One error in full — the document `gw/errorlog/{type}/{id}` answers, which
 * is HTML (measured: an empty content type, for both `Accept`s), not XML.
 * The header fields are its `Header Information` table's.
 */
export interface IGatewayErrorDetail extends IGatewayErrorEntry {
  /** The `Service Information` table's cells. */
  serviceInfo: {
    namespace?: string;
    serviceName?: string;
    serviceVersion?: string;
    /** `Service Group`. */
    groupId?: string;
    serviceRepository?: string;
    /** `RFC Destination`. */
    destination?: string;
  };
  errorContext: {
    /** `ERROR_CONTEXT/ERROR_INFO`. */
    errorInfo?: string;
    /** `ERROR_RESOLUTION`'s leaves — `SAP_NOTE`, `LINK_TO_SAP_NOTE`, … */
    resolution: Record<string, string>;
    /** `Exceptions`' nodes, in document order. */
    exceptions: IGatewayException[];
    /** Since 0.28.0: the whole `Error Context` tree, every row of it. */
    tree: IGatewayContextNode[];
  };
  /** `Source Code Extract`. */
  sourceCode: {
    lines: ISourceCodeLine[];
    /** The highlighted line's number; absent when no line is highlighted. */
    errorLine?: number;
  };
  /** `Active Calls/Events`, in the document's order. */
  callStack: ICallStackEntry[];
}

export type { IGatewayContextNode } from './gatewayHtml';

export interface IGatewayException {
  /** The exception class — the node's label. */
  type: string;
  /** Its `Text` leaf. */
  text?: string;
  /** Its `Raise Location` leaf. */
  raiseLocation?: string;
  /** Its `Attributes` node's leaves; absent when it has none. */
  attributes?: Record<string, string>;
}

export interface ICallStackEntry {
  number: number;
  event: string;
  program: string;
  name: string;
  line: number;
}

export interface ISourceCodeLine {
  number: number;
  content: string;
  isError: boolean;
}

// Namespace prefixes are stripped, so every field is looked up by its local
// name: `sm:validFrom` is `validFrom`. Nothing is lost for the fields read
// here — none of the extension names read (`severity`, `validFrom`,
// `validTo`) is an Atom element name (RFC 4287 §4) — and SAP's prefix for an
// extension is not fixed by the namespace. Until 0.28.0 they were looked up
// prefixed, which the stripping had removed, so they read empty.
//
// Values as written (`XML_TEXT_OPTIONS`, since 0.28.0): no tag or attribute
// is coerced to a number, and references decode as an XML parser decodes them.
// Until 0.28.0 element text that looked numeric was coerced (`0042` read
// `42`) and no reference was decoded (`&amp;` stayed `&amp;`).
const xmlParser = new XMLParser({
  ...XML_TEXT_OPTIONS,
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

/**
 * The document, parsed — or nothing, for a body that is empty or is not XML.
 * Reading nothing out of it is the truth about it; judging it is `analyse`'s.
 */
function parseOrEmpty(xml: string): unknown {
  if (!xml.trim()) return {};
  try {
    return parsedText(xmlParser, xml) ?? {};
  } catch {
    return {};
  }
}

/**
 * A leaf as text, `''` when absent or no text. The parser coerces nothing, so
 * the text is as written; every field below is declared a string.
 */
function str(value: unknown): string {
  return ownText(value) ?? '';
}

/** An element's text: its `#text` when it has attributes, else its value. */
function elementText(value: unknown): string {
  return ownText(value) ?? '';
}

/** The entries of an Atom feed, or none. */
function feedEntriesOf(xml: string): unknown[] {
  const entry = at(parseOrEmpty(xml), 'feed', 'entry');
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

/** The first of an element an entry may repeat (Atom allows several). */
function first(entry: unknown, name: string): unknown {
  return listOf(field(entry, name))[0];
}

/** The `term` of an entry's first `category`, where it is an element. */
function categoryTerm(entry: unknown): string | undefined {
  const category = first(entry, 'category');
  return isElement(category) ? leafText(field(category, '@_term')) : undefined;
}

/**
 * The entry's link: the `href` of its first `link` whose `rel` is absent or
 * `alternate` (the entry's own, RFC 4287 §4.2.7.2), else of its first `link`.
 * Until 0.28.0 an entry with several links read `''`.
 */
function entryLink(entry: unknown): string {
  const links = listOf(field(entry, 'link'));
  const own = links.find((link) => {
    const rel = leafText(field(link, '@_rel'));
    return rel === undefined || rel === 'alternate';
  });
  return str(field(own ?? links[0], '@_href'));
}

/** The name of the entry's first `author`. */
function authorName(entry: unknown): string | undefined {
  return leafText(field(first(entry, 'author'), 'name'));
}

/**
 * Parse Atom XML feed response into IFeedEntry array
 */
function parseAtomFeed(xml: string): IFeedEntry[] {
  return feedEntriesOf(xml).map((entry) => ({
    id: str(field(entry, 'id')),
    title: elementText(field(entry, 'title')),
    updated: str(field(entry, 'updated')),
    link: entryLink(entry),
    content: elementText(field(entry, 'content')),
    author: authorName(entry),
    category: categoryTerm(entry),
  }));
}

/**
 * Parse Atom XML feed list into IFeedDescriptor array
 */
function parseFeedDescriptors(xml: string): IFeedDescriptor[] {
  return feedEntriesOf(xml).map((entry) => ({
    id: str(field(entry, 'id')),
    title: elementText(field(entry, 'title')),
    url: entryLink(entry),
    category: categoryTerm(entry),
  }));
}

/**
 * Parse Atom XML feed variants into IFeedVariant array
 */
function parseFeedVariants(xml: string): IFeedVariant[] {
  return feedEntriesOf(xml).map((entry) => ({
    id: str(field(entry, 'id')),
    title: elementText(field(entry, 'title')),
    url: entryLink(entry),
  }));
}

/**
 * Parse Atom XML system messages feed into ISystemMessageEntry array
 */
function parseSystemMessages(xml: string): ISystemMessageEntry[] {
  return feedEntriesOf(xml).map((entry) => ({
    id: str(field(entry, 'id')),
    title: elementText(field(entry, 'title')),
    // System message fields may be in the content or as extensions
    text: elementText(field(entry, 'content')),
    severity: str(categoryTerm(entry) ?? field(entry, 'severity')),
    validFrom: str(field(entry, 'validFrom') ?? field(entry, 'updated')),
    validTo: str(field(entry, 'validTo')),
    createdBy: str(authorName(entry)),
  }));
}

/** A cell of a labelled table, as text; absent when the label is not there or the cell is empty. */
function cell(rows: Map<string, string>, label: string): string | undefined {
  const value = rows.get(label);
  return value === undefined ? undefined : cellText(value);
}

/** `name (id)` into its two parts; a text without ` (` is the name alone. */
function userParts(text: string | undefined): {
  username?: string;
  userId?: string;
} {
  if (text === undefined) return {};
  const open = text.lastIndexOf(' (');
  if (open < 0 || !text.endsWith(')')) return { username: text };
  const username = text.slice(0, open).trim();
  const userId = text.slice(open + 2, -1).trim();
  return {
    ...(username === '' ? {} : { username }),
    ...(userId === '' ? {} : { userId }),
  };
}

/** The `Header Information` fields of an error's HTML. */
function headerFields(html: string): IGatewayErrorEntry {
  const rows = labelledRows(sectionTable(html, 'HEADER_INFO'));
  const fields: Record<string, string | undefined> = {
    type: cell(rows, 'Type'),
    shortText: cell(rows, 'Short Text'),
    transactionId: cell(rows, 'Transaction ID'),
    package: cell(rows, 'Package'),
    applicationComponent: cell(rows, 'Application Component'),
    dateTime: cell(rows, 'Date/Time'),
    client: cell(rows, 'Client'),
    requestKind: cell(rows, 'Request Kind'),
    ...userParts(cell(rows, 'Username')),
  };
  return present(fields);
}

/** A record without its `undefined` fields. */
function present(
  fields: Record<string, string | undefined>,
): Record<string, string> {
  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) kept[key] = value;
  }
  return kept;
}

const ADT_PATH = '/sap/bc/adt/';

/** The summary's `HTTP link`, as a path from `/sap/bc/adt/`, and its last segment. */
function detailAddress(html: string): { detailUri?: string; errorId?: string } {
  const heading = html.indexOf('HTTP link');
  if (heading < 0) return {};
  const href = firstHref(html.slice(heading));
  if (href === undefined) return {};
  const at = href.indexOf(ADT_PATH);
  if (at < 0) return {};
  const detailUri = href.slice(at);
  const last = detailUri.slice(detailUri.lastIndexOf('/') + 1);
  let errorId: string | undefined;
  try {
    errorId = decodeURIComponent(last);
  } catch {
    errorId = undefined;
  }
  return errorId === undefined || errorId === ''
    ? { detailUri }
    : { detailUri, errorId };
}

/**
 * Parse the `gw/errorlog` feed into its entries: the `atom:` fields, and the
 * summary's `Header Information` cells and `HTTP link`.
 */
function parseGatewayErrors(xml: string): IGatewayErrorEntry[] {
  return feedEntriesOf(xml).map((entry) => {
    const summary = elementText(field(entry, 'summary'));
    const header = headerFields(summary);
    const title = elementText(field(entry, 'title')).trim();
    const colon = title.indexOf(':');
    const kind = colon > 0 ? title.slice(0, colon).trim() : undefined;
    const rest = colon > 0 ? title.slice(colon + 1).trim() : title;
    const author = userParts(authorName(entry));
    const updated = leafText(field(entry, 'updated'));
    const id = leafText(field(entry, 'id'));
    return {
      ...author,
      ...header,
      ...present({
        id,
        kind,
        shortText: header.shortText ?? (rest === '' ? undefined : rest),
        dateTime: updated,
      }),
      ...detailAddress(summary),
    };
  });
}

/** A number written as decimal digits; `undefined` for anything else. */
function wholeNumber(text: string | undefined): number | undefined {
  if (text === undefined || text === '') return undefined;
  for (const character of text) {
    if (character < '0' || character > '9') return undefined;
  }
  return Number(text);
}

/** The `Source Code Extract`: its line numbers beside its lines. */
function sourceCodeOf(html: string): IGatewayErrorDetail['sourceCode'] {
  const table = sectionTable(html, 'SOURCE');
  if (table === undefined) return { lines: [] };
  const [row] = tableRows(table);
  const [numbersCell, linesCell] = row ?? [];
  if (numbersCell === undefined || linesCell === undefined) {
    return { lines: [] };
  }
  // The highlighted line's number is not written: SAP writes `>>` in its
  // place (measured), so it is the one after the line before it.
  const numbers = elementsOf(numbersCell, 'span')
    .filter((span) => !span.includes('class="indicator"'))
    .map((span) => cellText(span));
  const divs = elementsOf(linesCell, 'div');
  const highlighted = divsHighlighted(linesCell);
  const lines: ISourceCodeLine[] = [];
  let previous: number | undefined;
  let errorLine: number | undefined;
  let numberAt = 0;
  for (const [index, div] of divs.entries()) {
    const isError = highlighted[index] === true;
    let number: number | undefined;
    if (isError) {
      number = previous === undefined ? undefined : previous + 1;
    } else {
      number = wholeNumber(numbers[numberAt]);
      numberAt += 1;
    }
    if (number === undefined) continue;
    previous = number;
    if (isError) errorLine = number;
    lines.push({
      number,
      content: htmlText(div).split('\u00a0').join(' '),
      isError,
    });
  }
  return errorLine === undefined ? { lines } : { lines, errorLine };
}

/** Which `<div>` of a cell carries the class `highlight`, by position. */
function divsHighlighted(fragment: string): boolean[] {
  const marks: boolean[] = [];
  let from = 0;
  for (;;) {
    const open = fragment.indexOf('<div', from);
    if (open < 0) break;
    const end = fragment.indexOf('>', open);
    if (end < 0) break;
    marks.push(fragment.slice(open, end).includes('highlight'));
    from = fragment.indexOf('</div>', end);
    if (from < 0) break;
  }
  return marks;
}

/** `Active Calls/Events`: one row a call, after the header row. */
function callStackOf(html: string): ICallStackEntry[] {
  const table = sectionTable(html, 'STACK');
  if (table === undefined) return [];
  const calls: ICallStackEntry[] = [];
  for (const [number, event, program, name, line] of tableRows(table)) {
    const n = wholeNumber(number === undefined ? undefined : cellText(number));
    const l = wholeNumber(line === undefined ? undefined : cellText(line));
    if (n === undefined || l === undefined) continue;
    calls.push({
      number: n,
      event: (event === undefined ? undefined : cellText(event)) ?? '',
      program: (program === undefined ? undefined : cellText(program)) ?? '',
      name: (name === undefined ? undefined : cellText(name)) ?? '',
      line: l,
    });
  }
  return calls;
}

/** A node's leaves, label to value. */
function leaves(node: IGatewayContextNode | undefined): Record<string, string> {
  const found: Record<string, string> = {};
  for (const child of node?.children ?? []) {
    if (child.children.length === 0 && child.value !== undefined) {
      found[child.label] = child.value;
    }
  }
  return found;
}

/** `Error Context`, read. */
function errorContextOf(html: string): IGatewayErrorDetail['errorContext'] {
  const tree = contextTree(sectionTable(html, 'CONTEXT'));
  const exceptions = (findNode(tree, 'Exceptions')?.children ?? []).map(
    (node): IGatewayException => {
      const attributes = leaves(
        node.children.find((child) => child.label === 'Attributes'),
      );
      const own = leaves(node);
      return {
        type: node.label,
        ...present({ text: own.Text, raiseLocation: own['Raise Location'] }),
        ...(Object.keys(attributes).length === 0 ? {} : { attributes }),
      };
    },
  );
  const errorInfo = findNode(tree, 'ERROR_INFO')?.value;
  return {
    ...(errorInfo === undefined ? {} : { errorInfo }),
    resolution: leaves(findNode(tree, 'ERROR_RESOLUTION')),
    exceptions,
    tree,
  };
}

/**
 * Parse one error's own document — HTML, its sections read by their
 * headings.
 */
function parseGatewayErrorDetail(html: string): IGatewayErrorDetail {
  const service = labelledRows(sectionTable(html, 'SERVICE'));
  return {
    ...headerFields(html),
    serviceInfo: present({
      namespace: cell(service, 'Service Namespace'),
      serviceName: cell(service, 'Service Name'),
      serviceVersion: cell(service, 'Service Version'),
      groupId: cell(service, 'Service Group'),
      serviceRepository: cell(service, 'Service Repository'),
      destination: cell(service, 'RFC Destination'),
    }),
    errorContext: errorContextOf(html),
    sourceCode: sourceCodeOf(html),
    callStack: callStackOf(html),
  };
}

/** The feeds this system offers — `list()`. */
export const feedDescriptors: IResultStrategy<IFeedDescriptor[]> = (answer) =>
  parseFeedDescriptors(rawOf(answer));

/** A category's variants — `variants()`. */
export const feedVariants: IResultStrategy<IFeedVariant[]> = (answer) =>
  parseFeedVariants(rawOf(answer));

/** Any feed's entries — `dumps()` and `byUrl()`. */
export const feedEntries: IResultStrategy<IFeedEntry[]> = (answer) =>
  parseAtomFeed(rawOf(answer));

/** The system-messages feed — `systemMessages()`. */
export const feedSystemMessages: IResultStrategy<ISystemMessageEntry[]> = (
  answer,
) => parseSystemMessages(rawOf(answer));

/** The gateway-error feed — `gatewayErrors()`. */
export const feedGatewayErrors: IResultStrategy<IGatewayErrorEntry[]> = (
  answer,
) => parseGatewayErrors(rawOf(answer));

/** One gateway error in full — `gatewayErrorDetail()`. */
export const feedGatewayErrorDetail: IResultStrategy<IGatewayErrorDetail> = (
  answer,
) => parseGatewayErrorDetail(rawOf(answer));
