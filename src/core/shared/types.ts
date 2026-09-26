/**
 * Shared types for cross-cutting ADT operations.
 *
 * The parameter types come from `@mcp-abap-adt/interfaces-adt`, which is where a
 * consumer reads what a member takes. What a *reading* builds is the reading's,
 * and the readings live in `@mcp-abap-adt/adt-strategies`.
 */

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
