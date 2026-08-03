/**
 * Shared operations - cross-cutting ADT functionality
 */

export { AdtUtils } from './AdtUtils';
// Error classes for unsupported operations
export {
  UnsupportedActivateOperationError,
  UnsupportedAdtOperationError,
  UnsupportedCheckOperationError,
  UnsupportedCreateOperationError,
  UnsupportedDeleteOperationError,
  UnsupportedUpdateOperationError,
  UnsupportedValidateOperationError,
} from './errors';
/**
 * Parsing a quickSearch payload the caller already holds.
 *
 * Exported because there is no other route to it: unlike the operations above,
 * it needs no connection, so `AdtClient.getUtils()` is not a path to it. A
 * caller that fetched the XML by other means — a batch response, a cached
 * document — would otherwise have to reach in past the package boundary.
 */
export { parseSearchResults } from './search';
export { getTransaction } from './transaction';
export type {
  AdtObjectType,
  AdtSourceObjectType,
  IGetDiscoveryParams as GetDiscoveryParams,
  IGetPackageContentsListOptions as GetPackageContentsListOptions,
  IGetPackageHierarchyOptions as GetPackageHierarchyOptions,
  IGetSqlQueryParams as GetSqlQueryParams,
  IGetTableContentsParams as GetTableContentsParams,
  IGetVirtualFoldersContentsParams as GetVirtualFoldersContentsParams,
  IGetWhereUsedListParams as GetWhereUsedListParams,
  IGetWhereUsedParams as GetWhereUsedParams,
  IGetWhereUsedScopeParams as GetWhereUsedScopeParams,
  IInactiveObjectsResponse as InactiveObjectsResponse,
  IObjectReference as ObjectReference,
  IPackageContentItem as PackageContentItem,
  IPackageHierarchyNode as PackageHierarchyNode,
  IReadOptions as ReadOptions,
  ISearchObjectsParams as SearchObjectsParams,
  IVirtualFoldersPreselection as VirtualFoldersPreselection,
  IWhereUsedListResult as WhereUsedListResult,
  IWhereUsedReference as WhereUsedReference,
  PackageHierarchyCodeFormat,
  PackageHierarchySupportedType,
} from './types';
