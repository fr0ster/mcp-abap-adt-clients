/**
 * Shared types for cross-cutting ADT operations
 */

/**
 * Object reference for group activation and inactive objects
 */
export interface IObjectReference {
    type: string;
    name: string;
}

/**
 * Response from getInactiveObjects
 */
export interface IInactiveObjectsResponse {
  objects: IObjectReference[];
  xmlStr?: string;
}

/**
 * Search objects parameters
 */
export interface ISearchObjectsParams {
  query: string;
  objectType?: string;
  maxResults?: number;
}

/**
 * Search result entry
 */
export interface ISearchResult {
  name: string;
  type: string;
  description: string;
  packageName?: string;
  uri?: string;
}

/**
 * SQL query parameters
 */
export interface IGetSqlQueryParams {
  sql_query: string;
  row_number?: number;
}

/**
 * Table contents parameters
 */
export interface IGetTableContentsParams {
  table_name: string;
  max_rows?: number;
}

/**
 * Where-used parameters
 */
export interface IGetWhereUsedParams {
  object_name: string;
  object_type: string;
  detailed?: boolean;
}
