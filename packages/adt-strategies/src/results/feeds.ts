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
import { at, field, isElement, leafText, listOf } from '../parsed';
import { rawOf } from '../result';

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

export interface IGatewayErrorEntry {
  type: string;
  shortText: string;
  transactionId: string;
  package: string;
  applicationComponent: string;
  dateTime: IAbapTimestamp;
  username: string;
  client: string;
  requestKind: string;
}

export interface IGatewayErrorDetail extends IGatewayErrorEntry {
  serviceInfo: {
    namespace: string;
    serviceName: string;
    serviceVersion: string;
    groupId: string;
    serviceRepository: string;
    destination: string;
  };
  errorContext: {
    errorInfo: string;
    resolution: Record<string, string>;
    exceptions: IGatewayException[];
  };
  sourceCode: {
    lines: ISourceCodeLine[];
    errorLine: number;
  };
  callStack: ICallStackEntry[];
}

export interface IGatewayException {
  type: string;
  text: string;
  raiseLocation: string;
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

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  processEntities: false,
});

/**
 * The document, parsed — or nothing, for a body that is empty or is not XML.
 * Reading nothing out of it is the truth about it; judging it is `analyse`'s.
 */
function parseOrEmpty(xml: string): unknown {
  if (!xml.trim()) return {};
  try {
    return xmlParser.parse(xml) ?? {};
  } catch {
    return {};
  }
}

/**
 * A leaf as text, `''` when absent or no text. This parser coerces element
 * text that looks numeric (`parseTagValue` is on), so a number is read back
 * as its text: every field below is declared a string.
 */
function str(value: unknown): string {
  return leafText(value) ?? '';
}

/**
 * A count as a number: a number as it is, a numeric text (attributes are kept
 * as text) as its value, anything else the fallback.
 */
function count(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/** An element's text: its `#text` when it has attributes, else its value. */
function elementText(value: unknown): string {
  return isElement(value) ? str(field(value, '#text')) : String(value ?? '');
}

/** The entries of an Atom feed, or none. */
function feedEntriesOf(xml: string): unknown[] {
  const entry = at(parseOrEmpty(xml), 'feed', 'entry');
  if (!entry) return [];
  return Array.isArray(entry) ? entry : [entry];
}

/** The `term` of an entry's `category`, where it is an element. */
function categoryTerm(entry: unknown): string | undefined {
  const category = field(entry, 'category');
  return isElement(category) ? leafText(field(category, '@_term')) : undefined;
}

/**
 * Parse Atom XML feed response into IFeedEntry array
 */
function parseAtomFeed(xml: string): IFeedEntry[] {
  return feedEntriesOf(xml).map((entry) => ({
    id: str(field(entry, 'id')),
    title: elementText(field(entry, 'title')),
    updated: str(field(entry, 'updated')),
    link: str(at(entry, 'link', '@_href')),
    content: elementText(field(entry, 'content')),
    author: leafText(at(entry, 'author', 'name')),
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
    url: str(at(entry, 'link', '@_href')),
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
    url: str(at(entry, 'link', '@_href')),
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
    severity: str(
      at(entry, 'category', '@_term') ?? field(entry, 'sm:severity'),
    ),
    validFrom: str(field(entry, 'sm:validFrom') ?? field(entry, 'updated')),
    validTo: str(field(entry, 'sm:validTo')),
    createdBy: str(at(entry, 'author', 'name')),
  }));
}

/**
 * Parse Atom XML gateway error feed into IGatewayErrorEntry array
 */
function parseGatewayErrors(xml: string): IGatewayErrorEntry[] {
  return feedEntriesOf(xml).map((entry) => {
    const category = field(entry, 'category');
    return {
      type: isElement(category)
        ? str(field(category, '@_term'))
        : String(category ?? ''),
      shortText: elementText(field(entry, 'title')),
      transactionId: str(field(entry, 'id')),
      package: str(field(entry, 'gw:package')),
      applicationComponent: str(field(entry, 'gw:applicationComponent')),
      dateTime: str(field(entry, 'updated')),
      username: str(at(entry, 'author', 'name')),
      client: str(field(entry, 'gw:client')),
      requestKind: str(field(entry, 'gw:requestKind')),
    };
  });
}

/**
 * Parse XML gateway error detail into IGatewayErrorDetail
 */
function parseGatewayErrorDetail(xml: string): IGatewayErrorDetail {
  const parsed = parseOrEmpty(xml);
  const root =
    field(parsed, 'errorlog:errorEntry') ??
    field(parsed, 'errorEntry') ??
    parsed;
  /** `errorlog:<name>` or `<name>`, the first present. */
  const either = (...names: string[]): unknown =>
    at(root, ...names.map((n) => `errorlog:${n}`)) ?? at(root, ...names);
  const attribute = (element: string, name: string): unknown =>
    field(field(root, `errorlog:${element}`), name) ??
    field(field(root, element), name);

  const callStackRaw = either('callStack', 'entry') ?? [];
  const callStack = listOf(callStackRaw).map((e, idx) => ({
    number: count(field(e, '@_number'), idx),
    event: str(field(e, '@_event')),
    program: str(field(e, '@_program')),
    name: str(field(e, '@_name')),
    line: count(field(e, '@_line'), 0),
  }));

  const linesRaw = either('sourceCode', 'line') ?? [];
  const sourceLines = listOf(linesRaw).map((l, idx) => ({
    number: count(field(l, '@_number'), idx),
    content: elementText(l),
    isError: field(l, '@_isError') === 'true' || field(l, '@_isError') === true,
  }));

  const exceptionsRaw = either('errorContext', 'exceptions', 'exception') ?? [];
  const exceptions = listOf(exceptionsRaw).map((ex) => ({
    type: str(field(ex, '@_type')),
    text: str(field(ex, '#text')),
    raiseLocation: str(field(ex, '@_raiseLocation')),
    attributes: undefined,
  }));

  return {
    type: str(field(root, '@_type')),
    shortText: str(either('shortText')),
    transactionId: str(either('transactionId')),
    package: str(either('package')),
    applicationComponent: str(either('applicationComponent')),
    dateTime: str(either('dateTime')),
    username: str(either('username')),
    client: str(either('client')),
    requestKind: str(either('requestKind')),
    serviceInfo: {
      namespace: str(attribute('serviceInfo', '@_namespace')),
      serviceName: str(attribute('serviceInfo', '@_serviceName')),
      serviceVersion: str(attribute('serviceInfo', '@_serviceVersion')),
      groupId: str(attribute('serviceInfo', '@_groupId')),
      serviceRepository: str(attribute('serviceInfo', '@_serviceRepository')),
      destination: str(attribute('serviceInfo', '@_destination')),
    },
    errorContext: {
      errorInfo: str(either('errorContext', 'errorInfo')),
      resolution: {},
      exceptions,
    },
    sourceCode: {
      lines: sourceLines,
      errorLine: count(attribute('sourceCode', '@_errorLine'), 0),
    },
    callStack,
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
