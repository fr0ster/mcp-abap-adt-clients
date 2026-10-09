import type {
  IResultStrategy,
  ITransportSearchConfiguration,
} from '@mcp-abap-adt/interfaces-adt';
import {
  type ICreatedTransport,
  parseCreatedTransport,
} from './parseCreatedTransport';
import {
  type ITransportObjectEntry,
  parseObjectEntries,
} from './parseObjectEntries';
import { parseSearchConfigurations } from './parseSearchConfigurations';
import { parseTransportTree } from './parseTransportTree';
import type { ITransportTree } from './types';

/**
 * The transport readings, as strategies for adt-clients' `getRequest(results)`.
 *
 * They were `transportDocuments`' defaults until adt-clients 23.0.0, which
 * made every caller of `getRequest()` receive the library's reading of the
 * document. The client answers documents as they arrived now; a caller who
 * wants these shapes passes them:
 *
 * ```typescript
 * const requests = client.getRequest({
 *   ...transportDocuments,
 *   list: transportTree,
 *   searchConfigurations: transportSearchConfigurations,
 * });
 * ```
 */

/** A created request or task: its number, read out of the answer. */
export const transportCreated: IResultStrategy<ICreatedTransport> = (answer) =>
  parseCreatedTransport(answer.data);

/** A saved-search listing, as the tree of requests, tasks and containers. */
export const transportTree: IResultStrategy<ITransportTree> = (answer) =>
  parseTransportTree(answer.data);

/** The saved transport searches — what `list` takes a `configUri` from. */
export const transportSearchConfigurations: IResultStrategy<
  ITransportSearchConfiguration[]
> = (answer) => parseSearchConfigurations(answer.data);

/** A request's object list, each entry with its position. */
export const transportObjectEntries: IResultStrategy<
  ITransportObjectEntry[]
> = (answer) => parseObjectEntries(answer.data);

export {
  type ICreatedTransport,
  parseCreatedTransport,
  parseObjectEntries,
  parseSearchConfigurations,
  parseTransportTree,
  type ITransportObjectEntry,
};
export type * from './types';
