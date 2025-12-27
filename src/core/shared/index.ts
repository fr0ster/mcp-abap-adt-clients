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
export { getTransaction } from './transaction';
export type {
  IGetDiscoveryParams as GetDiscoveryParams,
  IGetSqlQueryParams as GetSqlQueryParams,
  IGetTableContentsParams as GetTableContentsParams,
  IGetVirtualFoldersContentsParams as GetVirtualFoldersContentsParams,
  IGetWhereUsedParams as GetWhereUsedParams,
  IGetWhereUsedScopeParams as GetWhereUsedScopeParams,
  IInactiveObjectsResponse as InactiveObjectsResponse,
  IObjectReference as ObjectReference,
  IPackageHierarchyNode as PackageHierarchyNode,
  ISearchObjectsParams as SearchObjectsParams,
  IVirtualFoldersPreselection as VirtualFoldersPreselection,
} from './types';
