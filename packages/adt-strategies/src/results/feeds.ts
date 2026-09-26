/**
 * The Atom feeds `/sap/bc/adt/feeds` answers, read into entries.
 *
 * Moved from adt-clients, where these were the defaults of `FeedRepository` —
 * every member parsed its feed before a caller saw it. The members answer the
 * document as it came now; a caller who wants the entries passes these in the
 * result set it constructs the repository with:
 *
 * ```typescript
 * new FeedRepository(connection, logger, {
 *   ...feedDocuments,
 *   feeds: feedDescriptors,
 *   entries: feedEntries,
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
function parseOrEmpty(xml: string): any {
  if (!xml.trim()) return {};
  try {
    return xmlParser.parse(xml) ?? {};
  } catch {
    return {};
  }
}

/**
 * Parse Atom XML feed response into IFeedEntry array
 */
function parseAtomFeed(xml: string): IFeedEntry[] {
  const parsed = parseOrEmpty(xml);
  const feed = parsed.feed;
  if (!feed?.entry) return [];

  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

  return entries.map((entry: any) => ({
    id: entry.id ?? '',
    title:
      typeof entry.title === 'object'
        ? (entry.title['#text'] ?? '')
        : String(entry.title ?? ''),
    updated: entry.updated ?? '',
    link: entry.link?.['@_href'] ?? '',
    content:
      typeof entry.content === 'object'
        ? (entry.content['#text'] ?? '')
        : String(entry.content ?? ''),
    author: entry.author?.name,
    category:
      typeof entry.category === 'object' ? entry.category['@_term'] : undefined,
  }));
}

/**
 * Parse Atom XML feed list into IFeedDescriptor array
 */
function parseFeedDescriptors(xml: string): IFeedDescriptor[] {
  const parsed = parseOrEmpty(xml);
  const feed = parsed.feed;
  if (!feed?.entry) return [];

  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

  return entries.map((entry: any) => ({
    id: entry.id ?? '',
    title:
      typeof entry.title === 'object'
        ? (entry.title['#text'] ?? '')
        : String(entry.title ?? ''),
    url: entry.link?.['@_href'] ?? '',
    category:
      typeof entry.category === 'object' ? entry.category['@_term'] : undefined,
  }));
}

/**
 * Parse Atom XML feed variants into IFeedVariant array
 */
function parseFeedVariants(xml: string): IFeedVariant[] {
  const parsed = parseOrEmpty(xml);
  const feed = parsed.feed;
  if (!feed?.entry) return [];

  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

  return entries.map((entry: any) => ({
    id: entry.id ?? '',
    title:
      typeof entry.title === 'object'
        ? (entry.title['#text'] ?? '')
        : String(entry.title ?? ''),
    url: entry.link?.['@_href'] ?? '',
  }));
}

/**
 * Parse Atom XML system messages feed into ISystemMessageEntry array
 */
function parseSystemMessages(xml: string): ISystemMessageEntry[] {
  const parsed = parseOrEmpty(xml);
  const feed = parsed.feed;
  if (!feed?.entry) return [];

  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

  return entries.map((entry: any) => {
    // System message fields may be in the content or as extensions
    const content =
      typeof entry.content === 'object'
        ? (entry.content['#text'] ?? '')
        : String(entry.content ?? '');
    return {
      id: entry.id ?? '',
      title:
        typeof entry.title === 'object'
          ? (entry.title['#text'] ?? '')
          : String(entry.title ?? ''),
      text: content,
      severity: entry.category?.['@_term'] ?? entry['sm:severity'] ?? '',
      validFrom: entry['sm:validFrom'] ?? entry.updated ?? '',
      validTo: entry['sm:validTo'] ?? '',
      createdBy: entry.author?.name ?? '',
    };
  });
}

/**
 * Parse Atom XML gateway error feed into IGatewayErrorEntry array
 */
function parseGatewayErrors(xml: string): IGatewayErrorEntry[] {
  const parsed = parseOrEmpty(xml);
  const feed = parsed.feed;
  if (!feed?.entry) return [];

  const entries = Array.isArray(feed.entry) ? feed.entry : [feed.entry];

  return entries.map((entry: any) => ({
    type:
      typeof entry.category === 'object'
        ? (entry.category['@_term'] ?? '')
        : String(entry.category ?? ''),
    shortText:
      typeof entry.title === 'object'
        ? (entry.title['#text'] ?? '')
        : String(entry.title ?? ''),
    transactionId: entry.id ?? '',
    package: entry['gw:package'] ?? '',
    applicationComponent: entry['gw:applicationComponent'] ?? '',
    dateTime: entry.updated ?? '',
    username: entry.author?.name ?? '',
    client: entry['gw:client'] ?? '',
    requestKind: entry['gw:requestKind'] ?? '',
  }));
}

/**
 * Parse XML gateway error detail into IGatewayErrorDetail
 */
function parseGatewayErrorDetail(xml: string): IGatewayErrorDetail {
  const parsed = parseOrEmpty(xml);
  const root = parsed['errorlog:errorEntry'] ?? parsed['errorEntry'] ?? parsed;

  const callStackRaw =
    root['errorlog:callStack']?.['errorlog:entry'] ??
    root['callStack']?.['entry'] ??
    [];
  const callStack = (
    Array.isArray(callStackRaw) ? callStackRaw : [callStackRaw]
  ).map((e: any, idx: number) => ({
    number: e['@_number'] ?? idx,
    event: e['@_event'] ?? '',
    program: e['@_program'] ?? '',
    name: e['@_name'] ?? '',
    line: e['@_line'] ?? 0,
  }));

  const linesRaw =
    root['errorlog:sourceCode']?.['errorlog:line'] ??
    root['sourceCode']?.['line'] ??
    [];
  const sourceLines = (Array.isArray(linesRaw) ? linesRaw : [linesRaw]).map(
    (l: any, idx: number) => ({
      number: l['@_number'] ?? idx,
      content: typeof l === 'object' ? (l['#text'] ?? '') : String(l ?? ''),
      isError: l['@_isError'] === 'true' || l['@_isError'] === true,
    }),
  );

  const exceptionsRaw =
    root['errorlog:errorContext']?.['errorlog:exceptions']?.[
      'errorlog:exception'
    ] ??
    root['errorContext']?.['exceptions']?.['exception'] ??
    [];
  const exceptions = (
    Array.isArray(exceptionsRaw) ? exceptionsRaw : [exceptionsRaw]
  ).map((ex: any) => ({
    type: ex['@_type'] ?? '',
    text: ex['#text'] ?? '',
    raiseLocation: ex['@_raiseLocation'] ?? '',
    attributes: undefined,
  }));

  return {
    type: root['@_type'] ?? '',
    shortText: root['errorlog:shortText'] ?? root['shortText'] ?? '',
    transactionId:
      root['errorlog:transactionId'] ?? root['transactionId'] ?? '',
    package: root['errorlog:package'] ?? root['package'] ?? '',
    applicationComponent:
      root['errorlog:applicationComponent'] ??
      root['applicationComponent'] ??
      '',
    dateTime: root['errorlog:dateTime'] ?? root['dateTime'] ?? '',
    username: root['errorlog:username'] ?? root['username'] ?? '',
    client: root['errorlog:client'] ?? root['client'] ?? '',
    requestKind: root['errorlog:requestKind'] ?? root['requestKind'] ?? '',
    serviceInfo: {
      namespace:
        root['errorlog:serviceInfo']?.['@_namespace'] ??
        root['serviceInfo']?.['@_namespace'] ??
        '',
      serviceName:
        root['errorlog:serviceInfo']?.['@_serviceName'] ??
        root['serviceInfo']?.['@_serviceName'] ??
        '',
      serviceVersion:
        root['errorlog:serviceInfo']?.['@_serviceVersion'] ??
        root['serviceInfo']?.['@_serviceVersion'] ??
        '',
      groupId:
        root['errorlog:serviceInfo']?.['@_groupId'] ??
        root['serviceInfo']?.['@_groupId'] ??
        '',
      serviceRepository:
        root['errorlog:serviceInfo']?.['@_serviceRepository'] ??
        root['serviceInfo']?.['@_serviceRepository'] ??
        '',
      destination:
        root['errorlog:serviceInfo']?.['@_destination'] ??
        root['serviceInfo']?.['@_destination'] ??
        '',
    },
    errorContext: {
      errorInfo:
        root['errorlog:errorContext']?.['errorlog:errorInfo'] ??
        root['errorContext']?.['errorInfo'] ??
        '',
      resolution: {},
      exceptions,
    },
    sourceCode: {
      lines: sourceLines,
      errorLine:
        root['errorlog:sourceCode']?.['@_errorLine'] ??
        root['sourceCode']?.['@_errorLine'] ??
        0,
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
