/**
 * FeedRepository - Domain object for feed operations
 *
 * Provides access to feed reader, runtime dumps, system messages,
 * and gateway error feeds with Atom XML parsing.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import type { IRuntimeAnalysisObject } from '../types';
import { fetchFeed, getFeeds, getFeedVariants } from './read';
import type {
  IFeedDescriptor,
  IFeedEntry,
  IFeedQueryOptions,
  IFeedRepository,
  IFeedVariant,
  IGatewayErrorDetail,
  IGatewayErrorEntry,
  ISystemMessageEntry,
} from './types';

const FEED_URLS = {
  dumps: '/sap/bc/adt/runtime/dumps',
  systemMessages: '/sap/bc/adt/runtime/systemmessages',
  gatewayErrors: '/sap/bc/adt/gw/errorlog',
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  processEntities: false,
});

/**
 * Parse Atom XML feed response into IFeedEntry array
 */
function parseAtomFeed(xml: string): IFeedEntry[] {
  const parsed = xmlParser.parse(xml);
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
  const parsed = xmlParser.parse(xml);
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
  const parsed = xmlParser.parse(xml);
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
  const parsed = xmlParser.parse(xml);
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
  const parsed = xmlParser.parse(xml);
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
  const parsed = xmlParser.parse(xml);
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

export class FeedRepository implements IFeedRepository, IRuntimeAnalysisObject {
  readonly kind = 'feedRepository' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(): Promise<IFeedDescriptor[]> {
    const response = await getFeeds(this.connection);
    return parseFeedDescriptors(response.data);
  }

  async variants(): Promise<IFeedVariant[]> {
    const response = await getFeedVariants(this.connection);
    return parseFeedVariants(response.data);
  }

  async dumps(options?: IFeedQueryOptions): Promise<IFeedEntry[]> {
    return this.byUrl(FEED_URLS.dumps, options);
  }

  async systemMessages(
    options?: IFeedQueryOptions,
  ): Promise<ISystemMessageEntry[]> {
    const response = await fetchFeed(
      this.connection,
      FEED_URLS.systemMessages,
      options,
    );
    return parseSystemMessages(response.data);
  }

  async gatewayErrors(
    options?: IFeedQueryOptions,
  ): Promise<IGatewayErrorEntry[]> {
    const response = await fetchFeed(
      this.connection,
      FEED_URLS.gatewayErrors,
      options,
      'username',
    );
    return parseGatewayErrors(response.data);
  }

  async gatewayErrorDetail(feedUrl: string): Promise<IGatewayErrorDetail> {
    const response = await fetchFeed(this.connection, feedUrl);
    return parseGatewayErrorDetail(response.data);
  }

  /**
   * Fetch and parse any feed URL as generic IFeedEntry array.
   * Internal helper — not part of IFeedRepository.
   */
  async byUrl(
    feedUrl: string,
    options?: IFeedQueryOptions,
  ): Promise<IFeedEntry[]> {
    const response = await fetchFeed(this.connection, feedUrl, options);
    return parseAtomFeed(response.data);
  }
}
