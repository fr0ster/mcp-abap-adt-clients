/**
 * Feed Reader
 *
 * Provides functions for accessing feed repository:
 * - Get feeds
 * - Get feed variants
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  IFeedQueryOptions,
} from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get feeds
 *
 * @param connection - ABAP connection
 * @returns Axios response with feeds
 */
export async function getFeeds(
  connection: IAbapConnection,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/feeds`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/atom+xml;type=feed',
    },
  });
}

/**
 * Get feed variants
 *
 * The endpoint requires `category` and refuses the request without it — measured
 * on E19 2026-08-31: `GET /sap/bc/adt/feeds/variants` answers
 * `400 ExceptionParameterNotFound`, `SADT_RESOURCE/017`, "Parameter category
 * could not be found", and the same call with a category answers 200. It was
 * being sent without one, so this never worked.
 *
 * Left as a plain string rather than a union: on that system every value tried
 * — feed ids from `/sap/bc/adt/feeds`, and invented ones — answered 200 with an
 * empty body, so there is nothing to enumerate from and no evidence for what
 * the valid set is.
 *
 * @param connection - ABAP connection
 * @param category - required by the endpoint; without it the request is refused
 * @returns Axios response with feed variants
 */
export async function getFeedVariants(
  connection: IAbapConnection,
  category: string,
): Promise<IAdtWireResponse> {
  if (!category) {
    throw new Error('category is required for /sap/bc/adt/feeds/variants');
  }
  const url = `/sap/bc/adt/feeds/variants?category=${encodeURIComponent(category)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/atom+xml;type=feed',
    },
  });
}

/**
 * Build query string from IFeedQueryOptions.
 * Shared by all feed-backed runtime modules.
 *
 * @param options - Query options
 * @param userAttribute - Feed-specific user attribute name ('user' for dumps, 'username' for gateway)
 */
export function buildFeedQueryParams(
  options?: IFeedQueryOptions,
  userAttribute = 'user',
): string {
  if (!options) return '';
  const params = new URLSearchParams();
  if (options.user) {
    params.set(
      '$query',
      `and ( equals ( ${userAttribute} , ${options.user.trim()} ) )`,
    );
  }
  if (options.maxResults) {
    params.set('$top', String(options.maxResults));
  }
  if (options.from) params.set('from', options.from);
  if (options.to) params.set('to', options.to);
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Fetch a feed by URL with optional query parameters
 *
 * @param connection - ABAP connection
 * @param feedUrl - Feed URL path
 * @param options - Query options (user filter, pagination, date range)
 * @returns Axios response with Atom XML feed
 */
export async function fetchFeed(
  connection: IAbapConnection,
  feedUrl: string,
  options?: IFeedQueryOptions,
  userAttribute?: string,
): Promise<IAdtWireResponse> {
  const url = `${feedUrl}${buildFeedQueryParams(options, userAttribute)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: { Accept: 'application/atom+xml;type=feed' },
  });
}
