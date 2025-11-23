/**
 * Shared types for cross-cutting ADT operations
 */

/**
 * Object reference for group activation and inactive objects
 */
export interface ObjectReference {
    type: string;
    name: string;
}

/**
 * Response from getInactiveObjects
 */
export interface InactiveObjectsResponse {
  objects: ObjectReference[];
  xmlStr?: string;
}

/**
 * Search objects parameters
 */
export interface SearchObjectsParams {
  query: string;
  objectType?: string;
  maxResults?: number;
}

/**
 * Search result entry
 */
export interface SearchResult {
  name: string;
  type: string;
  description: string;
  packageName?: string;
  uri?: string;
}

/**
 * SQL query parameters
 */
export interface GetSqlQueryParams {
  sql_query: string;
  row_number?: number;
}

/**
 * Table contents parameters
 */
export interface GetTableContentsParams {
  table_name: string;
  max_rows?: number;
}

/**
 * Where-used parameters
 */
export interface GetWhereUsedParams {
  object_name: string;
  object_type: string;
  detailed?: boolean;
}
