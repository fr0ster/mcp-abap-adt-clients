/**
 * Shared types for cross-cutting ADT operations.
 *
 * The parameter types come from `@mcp-abap-adt/interfaces`, which is where a
 * consumer reads what a member takes. The *result* shapes are this package's
 * and live in `./utilResults`, beside the readings that build them — decision
 * 24 in the contract's DECISIONS.md.
 */

// Types defined in @mcp-abap-adt/interfaces
export type {
  AdtObjectType,
  AdtObjectTypeLower,
  AdtSourceObjectType,
  AdtSourceObjectTypeLower,
  IGetDiscoveryParams,
  IGetNodeContentsOptions,
  IGetPackageContentsOptions,
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IGetVirtualFoldersContentsParams,
  IGetWhereUsedListParams,
  IGetWhereUsedParams,
  IGetWhereUsedScopeParams,
  IReadOptions,
  ISearchObjectsParams,
  IVirtualFoldersPreselection,
} from '@mcp-abap-adt/interfaces';

// The shapes this package's readings build.
export type {
  IAdtObjectHit,
  IGetPackageContentsListOptions,
  IGetPackageHierarchyOptions,
  IInactiveObjectsResponse,
  INamedItem,
  IObjectReference,
  IPackageContentItem,
  IPackageHierarchyNode,
  IRepositoryNodeChild,
  IRepositoryNodeContents,
  IRepositoryObjectNode,
  ISearchResult,
  IWhereUsedListResult,
  IWhereUsedReference,
  PackageHierarchyCodeFormat,
  PackageHierarchySupportedType,
} from './utilResults';
