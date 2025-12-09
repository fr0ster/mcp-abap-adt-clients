/**
 * Shared operations - cross-cutting ADT functionality
 */

export { SharedBuilder } from './SharedBuilder';
export type { 
  ObjectReference,
  InactiveObjectsResponse,
  SearchObjectsParams,
  GetSqlQueryParams,
  GetTableContentsParams,
  GetWhereUsedParams
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
