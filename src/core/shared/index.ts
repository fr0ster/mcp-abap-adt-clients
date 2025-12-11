/**
 * Shared operations - cross-cutting ADT functionality
 */

export { SharedBuilder } from './SharedBuilder';
export { AdtUtils } from './AdtUtils';
export type { 
  IObjectReference as ObjectReference,
  IInactiveObjectsResponse as InactiveObjectsResponse,
  ISearchObjectsParams as SearchObjectsParams,
  IGetSqlQueryParams as GetSqlQueryParams,
  IGetTableContentsParams as GetTableContentsParams,
  IGetWhereUsedParams as GetWhereUsedParams
} from './types';

// Error classes for unsupported operations
export {
  UnsupportedAdtOperationError,
  UnsupportedCreateOperationError,
  UnsupportedUpdateOperationError,
  UnsupportedDeleteOperationError,
  UnsupportedActivateOperationError,
  UnsupportedCheckOperationError,
  UnsupportedValidateOperationError
} from './errors';
