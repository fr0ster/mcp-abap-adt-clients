/**
 * Shared types for cross-cutting ADT operations.
 *
 * The parameter types come from `@mcp-abap-adt/interfaces-adt`, which is where a
 * consumer reads what a member takes. What a *reading* builds is the reading's,
 * and the readings live in `@mcp-abap-adt/adt-strategies`.
 */

import type {
  IAdtAnalyseOptions,
  IAdtError,
  IAdtResponse,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';

export type {
  AdtObjectType,
  AdtObjectTypeLower,
  AdtSourceObjectType,
  AdtSourceObjectTypeLower,
  IGetDiscoveryParams,
  IGetNodeContentsOptions,
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IGetVirtualFoldersContentsParams,
  IGetWhereUsedParams,
  IGetWhereUsedScopeParams,
  IObjectReference,
  IReadOptions,
  ISearchObjectsParams,
  IVirtualFoldersPreselection,
} from '@mcp-abap-adt/interfaces-adt';

export type { INamedItem } from './utilResults';

/**
 * `/repository/informationsystem/objectproperties/values` — the properties of
 * one repository object, named by its ADT uri.
 *
 * Declared here, beside the class that implements it, because
 * `@mcp-abap-adt/interfaces-adt` has no atom for this endpoint yet; it has the
 * shape of that package's atoms (two call signatures: a caller's error
 * strategy, or the library's verdict) so it can move there unchanged.
 */
export interface IAdtObjectProperties<TProperties> {
  /**
   * The properties of the object `objectUri` names: the object's name, type,
   * text and package, and one property per facet.
   */
  getObjectProperties<E extends IAdtError>(
    objectUri: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<TProperties, E>>;
  getObjectProperties(
    objectUri: string,
    options?: IAdtAnalyseOptions,
  ): Promise<IAdtResponse<TProperties>>;
}
