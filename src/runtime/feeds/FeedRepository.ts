/**
 * FeedRepository - Domain object for feed operations
 *
 * Provides access to the feed reader, runtime dumps, system messages and
 * gateway error feeds. Every member answers its feed as it arrived; the Atom
 * readings live in `@mcp-abap-adt/adt-strategies` (`feedEntries` & co.).
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IFeedQueryOptions,
  IFeedRepository,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import type { IRuntimeAnalysisObject } from '../types';
import { fetchFeed, getFeeds, getFeedVariants } from './read';

const FEED_URLS = {
  dumps: '/sap/bc/adt/runtime/dumps',
  systemMessages: '/sap/bc/adt/runtime/systemmessages',
  gatewayErrors: '/sap/bc/adt/gw/errorlog',
};

/**
 * One strategy per member of a feed repository.
 *
 * `IFeedRepository<TFeeds, TVariants, TEntries, TSystemMessages,
 * TGatewayErrors, TGatewayErrorDetail>` is generic in all six, and this fills
 * them in.
 */
export interface IFeedResults {
  readonly feeds: IResultStrategy<unknown>;
  readonly variants: IResultStrategy<unknown>;
  /** Any feed's entries — `dumps` and `byUrl`. */
  readonly entries: IResultStrategy<unknown>;
  readonly systemMessages: IResultStrategy<unknown>;
  readonly gatewayErrors: IResultStrategy<unknown>;
  readonly gatewayErrorDetail: IResultStrategy<unknown>;
}

/**
 * The shipped default: every feed answered as the document it arrived as.
 *
 * Until now these parsed the Atom — the readings are `feedDescriptors`,
 * `feedVariants`, `feedEntries`, `feedSystemMessages`, `feedGatewayErrors` and
 * `feedGatewayErrorDetail` in `@mcp-abap-adt/adt-strategies`.
 *
 * `satisfies`, never an annotation — see `classDocuments` for why.
 */
export const feedDocuments = {
  feeds: rawDocument,
  variants: rawDocument,
  entries: rawDocument,
  systemMessages: rawDocument,
  gatewayErrors: rawDocument,
  gatewayErrorDetail: rawDocument,
} satisfies IFeedResults;

export class FeedRepository<R extends IFeedResults = typeof feedDocuments>
  implements
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
    private readonly results: R = feedDocuments as unknown as R,
  ) {}

  /** The feeds this system offers. */
  async list<E extends IAdtError = IAdtError>(
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['feeds']>, E>> {
    return answering(
      () => getFeeds(this.connection),
      this.results.feeds as IResultStrategy<ReturnType<R['feeds']>>,
      options?.analyse,
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
  async variants<E extends IAdtError = IAdtError>(
    category: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['variants']>, E>> {
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
      options?.analyse,
    );
  }

  /** The runtime dumps feed. */
  async dumps<E extends IAdtError = IAdtError>(
    options?: IFeedQueryOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['entries']>, E>> {
    return this.byUrl(FEED_URLS.dumps, options);
  }

  /** The system-messages feed. */
  async systemMessages<E extends IAdtError = IAdtError>(
    options?: IFeedQueryOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['systemMessages']>, E>> {
    return answering(
      () => fetchFeed(this.connection, FEED_URLS.systemMessages, options),
      this.results.systemMessages as IResultStrategy<
        ReturnType<R['systemMessages']>
      >,
      options?.analyse,
    );
  }

  /**
   * The gateway-error feed.
   *
   * Filtered by `username`, not `user`: this feed names the parameter
   * differently from the others.
   */
  async gatewayErrors<E extends IAdtError = IAdtError>(
    options?: IFeedQueryOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['gatewayErrors']>, E>> {
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
      options?.analyse,
    );
  }

  /** One gateway error, in full. */
  async gatewayErrorDetail<E extends IAdtError = IAdtError>(
    feedUrl: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['gatewayErrorDetail']>, E>> {
    return answering(
      () => fetchFeed(this.connection, feedUrl),
      this.results.gatewayErrorDetail as IResultStrategy<
        ReturnType<R['gatewayErrorDetail']>
      >,
      options?.analyse,
    );
  }

  /**
   * Any feed URL, read as entries.
   *
   * Not part of `IFeedRepository`: a caller who has a feed's URL from `list()`
   * can read it without this package naming that feed.
   */
  async byUrl<E extends IAdtError = IAdtError>(
    feedUrl: string,
    options?: IFeedQueryOptions & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['entries']>, E>> {
    return answering(
      () => fetchFeed(this.connection, feedUrl, options),
      this.results.entries as IResultStrategy<ReturnType<R['entries']>>,
      options?.analyse,
    );
  }
}
