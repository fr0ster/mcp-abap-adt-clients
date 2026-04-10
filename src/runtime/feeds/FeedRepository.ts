/**
 * FeedRepository - Domain object for feed operations
 *
 * Provides access to feed reader, runtime dumps, system messages,
 * and gateway error feeds with Atom XML parsing.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import type { IRuntimeAnalysisObject } from '../types';
import { fetchFeed, getFeeds, getFeedVariants } from './read';
import type { IFeedEntry, IFeedQueryOptions, IFeedRepository } from './types';

const FEED_URLS = {
  dumps: '/sap/bc/adt/runtime/dumps',
  systemMessages: '/sap/bc/adt/runtime/systemmessages',
  gatewayErrors: '/sap/bc/adt/gw/errorlog',
};

/**
 * Parse Atom XML feed response into IFeedEntry array
 */
function parseAtomFeed(xml: string): IFeedEntry[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    removeNSPrefix: true,
  });

  const parsed = parser.parse(xml);
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

export class FeedRepository implements IFeedRepository, IRuntimeAnalysisObject {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async list(): Promise<AxiosResponse> {
    return getFeeds(this.connection);
  }

  async variants(): Promise<AxiosResponse> {
    return getFeedVariants(this.connection);
  }

  async dumps(options?: IFeedQueryOptions): Promise<IFeedEntry[]> {
    return this.byUrl(FEED_URLS.dumps, options);
  }

  async systemMessages(options?: IFeedQueryOptions): Promise<IFeedEntry[]> {
    return this.byUrl(FEED_URLS.systemMessages, options);
  }

  async gatewayErrors(options?: IFeedQueryOptions): Promise<IFeedEntry[]> {
    return this.byUrl(FEED_URLS.gatewayErrors, options);
  }

  async byUrl(
    feedUrl: string,
    options?: IFeedQueryOptions,
  ): Promise<IFeedEntry[]> {
    const response = await fetchFeed(this.connection, feedUrl, options);
    return parseAtomFeed(response.data);
  }
}
