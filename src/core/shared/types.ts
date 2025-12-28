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
 * Read options for source/metadata operations
 */
export interface IReadOptions {
  withLongPolling?: boolean;
  accept?: string;
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
 * ADT discovery request parameters
 */
export interface IGetDiscoveryParams {
  requestId?: string;
  timeout?: number;
}

/**
 * Where-used scope parameters (Step 1: get available object types)
 */
export interface IGetWhereUsedScopeParams {
  object_name: string;
  object_type: string;
}

/**
 * Where-used parameters (Step 2: execute search)
 */
export interface IGetWhereUsedParams {
  object_name: string;
  object_type: string;
  /**
   * Optional: scope XML from getWhereUsedScope() with user-modified selections
   * If not provided, will fetch default scope automatically
   */
  scopeXml?: string;
}

/**
 * Virtual folders preselection entry
 */
export interface IVirtualFoldersPreselection {
  facet: string;
  values: string[];
}

/**
 * Virtual folders contents parameters
 */
export interface IGetVirtualFoldersContentsParams {
  objectSearchPattern?: string;
  preselection?: IVirtualFoldersPreselection[];
  facetOrder?: string[];
  withVersions?: boolean;
  ignoreShortDescriptions?: boolean;
}

export interface IGetPackageHierarchyOptions {
  includeSubpackages?: boolean;
  maxDepth?: number;
  includeDescriptions?: boolean;
}

export type PackageHierarchySupportedType =
  | 'package'
  | 'domain'
  | 'dataElement'
  | 'structure'
  | 'table'
  | 'tableType'
  | 'view'
  | 'class'
  | 'interface'
  | 'program'
  | 'functionGroup'
  | 'functionModule'
  | 'serviceDefinition'
  | 'metadataExtension'
  | 'behaviorDefinition'
  | 'behaviorImplementation';

export type PackageHierarchyCodeFormat = 'source' | 'xml';

export interface IPackageHierarchyNode {
  name: string;
  adtType?: string;
  type?: PackageHierarchySupportedType;
  description?: string;
  is_package: boolean;
  codeFormat?: PackageHierarchyCodeFormat;
  restoreStatus?: 'ok' | 'not-implemented';
  children?: IPackageHierarchyNode[];
}
