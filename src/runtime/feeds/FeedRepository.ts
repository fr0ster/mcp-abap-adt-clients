/**
 * FeedRepository - Domain object for feed operations
 *
 * Provides access to feed reader, runtime dumps, system messages,
 * and gateway error feeds with Atom XML parsing.
 */

import type {
  IAbapConnection,
  IAdtResponse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { answering } from '../../utils/adtResponse';
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

/**
 * One strategy per member of a feed repository.
 *
 * `IFeedRepository<TFeeds, TVariants, TEntries, TSystemMessages,
 * TGatewayErrors, TGatewayErrorDetail>` is generic in all six since 30.0.0, and
 * this fills them in. The defaults are the parsed shapes — a feed is an Atom
 * document whose entries are the point, and every caller of these was parsing
 * it — while `rawDocument` for any member gives the document back.
 */
export interface IFeedResults<
  TFeeds = IFeedDescriptor[],
  TVariants = IFeedVariant[],
  TEntries = IFeedEntry[],
  TSystemMessages = ISystemMessageEntry[],
  TGatewayErrors = IGatewayErrorEntry[],
  TGatewayErrorDetail = IGatewayErrorDetail,
> {
  readonly feeds: IResultStrategy<TFeeds>;
  readonly variants: IResultStrategy<TVariants>;
  readonly entries: IResultStrategy<TEntries>;
  readonly systemMessages: IResultStrategy<TSystemMessages>;
  readonly gatewayErrors: IResultStrategy<TGatewayErrors>;
  readonly gatewayErrorDetail: IResultStrategy<TGatewayErrorDetail>;
}

/**
 * The shipped default: each feed read as its entries.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const feedResults = {
  feeds: (answer) => parseFeedDescriptors(answer.data),
  variants: (answer) => parseFeedVariants(answer.data),
  entries: (answer) => parseAtomFeed(answer.data),
  systemMessages: (answer) => parseSystemMessages(answer.data),
  gatewayErrors: (answer) => parseGatewayErrors(answer.data),
  gatewayErrorDetail: (answer) => parseGatewayErrorDetail(answer.data),
} satisfies IFeedResults;

export class FeedRepository<
  R extends IFeedResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IFeedResults,
> implements
    IFeedRepository<
      ReturnType<R['feeds']>,
      ReturnType<R['variants']>,
      ReturnType<R['entries']>,
      ReturnType<R['systemMessages']>,
      ReturnType<R['gatewayErrors']>,
      ReturnType<R['gatewayErrorDetail']>
    >,
    IRuntimeAnalysisObject
{
  readonly kind = 'feedRepository' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = feedResults as unknown as R,
  ) {}

  /** The feeds this system offers. */
  async list(): Promise<IAdtResponse<ReturnType<R['feeds']>>> {
    return answering(
      () => getFeeds(this.connection),
      this.results.feeds as IResultStrategy<ReturnType<R['feeds']>>,
    );
  }

  /**
   * Feed variants for a category.
   *
   * Required, because the endpoint requires it: without a category
   * `/sap/bc/adt/feeds/variants` answers `400 ExceptionParameterNotFound`,
   * "Parameter category could not be found." Everything that called this before
   * `@mcp-abap-adt/interfaces@26.0.0` fixed the contract was getting that 400.
   */
  async variants(
    category: string,
  ): Promise<IAdtResponse<ReturnType<R['variants']>>> {
    // The compiler rejects a missing category; JavaScript callers reach here
    // anyway, so it says so rather than sending a request the server answers
    // with 400.
    if (!category) {
      throw new Error(
        'FeedRepository.variants() requires a category — /sap/bc/adt/feeds/variants ' +
          'answers 400 ExceptionParameterNotFound without one.',
      );
    }
    return answering(
      () => getFeedVariants(this.connection, category),
      this.results.variants as IResultStrategy<ReturnType<R['variants']>>,
    );
  }

  /** The runtime dumps feed. */
  async dumps(
    options?: IFeedQueryOptions,
  ): Promise<IAdtResponse<ReturnType<R['entries']>>> {
    return this.byUrl(FEED_URLS.dumps, options);
  }

  /** The system-messages feed. */
  async systemMessages(
    options?: IFeedQueryOptions,
  ): Promise<IAdtResponse<ReturnType<R['systemMessages']>>> {
    return answering(
      () => fetchFeed(this.connection, FEED_URLS.systemMessages, options),
      this.results.systemMessages as IResultStrategy<
        ReturnType<R['systemMessages']>
      >,
    );
  }

  /**
   * The gateway-error feed.
   *
   * Filtered by `username`, not `user`: this feed names the parameter
   * differently from the others.
   */
  async gatewayErrors(
    options?: IFeedQueryOptions,
  ): Promise<IAdtResponse<ReturnType<R['gatewayErrors']>>> {
    return answering(
      () =>
        fetchFeed(
          this.connection,
          FEED_URLS.gatewayErrors,
          options,
          'username',
        ),
      this.results.gatewayErrors as IResultStrategy<
        ReturnType<R['gatewayErrors']>
      >,
    );
  }

  /** One gateway error, in full. */
  async gatewayErrorDetail(
    feedUrl: string,
  ): Promise<IAdtResponse<ReturnType<R['gatewayErrorDetail']>>> {
    return answering(
      () => fetchFeed(this.connection, feedUrl),
      this.results.gatewayErrorDetail as IResultStrategy<
        ReturnType<R['gatewayErrorDetail']>
      >,
    );
  }

  /**
   * Any feed URL, read as entries.
   *
   * Not part of `IFeedRepository`: a caller who has a feed's URL from `list()`
   * can read it without this package naming that feed.
   */
  async byUrl(
    feedUrl: string,
    options?: IFeedQueryOptions,
  ): Promise<IAdtResponse<ReturnType<R['entries']>>> {
    return answering(
      () => fetchFeed(this.connection, feedUrl, options),
      this.results.entries as IResultStrategy<ReturnType<R['entries']>>,
    );
  }
}
