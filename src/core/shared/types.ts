/**
 * Shared types for cross-cutting ADT operations
 */

export type AdtObjectTypeLower =
  | 'class'
  | 'clas/oc'
  | 'program'
  | 'prog/p'
  | 'interface'
  | 'intf/if'
  | 'functionmodule'
  | 'fugr/ff'
  | 'view'
  | 'ddls/df'
  | 'structure'
  | 'stru/dt'
  | 'table'
  | 'tabl/dt'
  | 'tabletype'
  | 'ttyp/df'
  | 'domain'
  | 'doma/dd'
  | 'dataelement'
  | 'dtel'
  | 'functiongroup'
  | 'fugr'
  | 'package'
  | 'devc/k';

export type AdtObjectType = AdtObjectTypeLower | Uppercase<AdtObjectTypeLower>;

export type AdtSourceObjectTypeLower =
  | 'class'
  | 'clas/oc'
  | 'program'
  | 'prog/p'
  | 'interface'
  | 'intf/if'
  | 'functionmodule'
  | 'fugr/ff'
  | 'view'
  | 'ddls/df'
  | 'structure'
  | 'stru/dt'
  | 'table'
  | 'tabl/dt'
  | 'tabletype'
  | 'ttyp/df';

export type AdtSourceObjectType =
  | AdtSourceObjectTypeLower
  | Uppercase<AdtSourceObjectTypeLower>;

/**
 * Object reference for group activation and inactive objects
 */
export interface IObjectReference {
  type: string;
  name: string;
  parentName?: string;
}

/**
 * Read options for source/metadata operations
 */
export interface IReadOptions {
  withLongPolling?: boolean;
  accept?: string;
  version?: 'active' | 'inactive';
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
 * Parameters for getWhereUsedList (parsed version)
 */
export interface IGetWhereUsedListParams {
  object_name: string;
  object_type: string;
  /**
   * If true, searches in all available object types (Eclipse 'select all' behavior)
   * Default: false (uses SAP default scope)
   */
  enableAllTypes?: boolean;
  /**
   * Include raw XML in response
   * Default: false
   */
  includeRawXml?: boolean;
}

/**
 * Single where-used reference
 */
export interface IWhereUsedReference {
  /** ADT URI of the referencing object */
  uri: string;
  /** Object name */
  name: string;
  /** ADT object type (e.g., 'CLAS/OC', 'DDLS/DF') */
  type: string;
  /** Parent URI (for hierarchical display) */
  parentUri?: string;
  /** Package name containing the object */
  packageName?: string;
  /** Responsible user */
  responsible?: string;
  /** Whether this is a direct result or container */
  isResult: boolean;
  /** Usage information (e.g., 'gradeDirect,includeProductive') */
  usageInformation?: string;
  /** Object identifier for navigation */
  objectIdentifier?: string;
}

/**
 * Result from getWhereUsedList
 */
export interface IWhereUsedListResult {
  /** Object that was searched */
  objectName: string;
  /** Object type that was searched */
  objectType: string;
  /** Total number of references found */
  totalReferences: number;
  /** Result description from SAP */
  resultDescription: string;
  /** List of referencing objects (excluding packages) */
  references: IWhereUsedReference[];
  /** Raw XML response (if includeRawXml was true) */
  rawXml?: string;
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

/**
 * Options for getPackageContentsList
 */
export interface IGetPackageContentsListOptions {
  /** Include contents of subpackages recursively (default: false) */
  includeSubpackages?: boolean;
  /** Maximum depth for subpackage traversal (default: 5) */
  maxDepth?: number;
  /** Include object descriptions (default: true) */
  includeDescriptions?: boolean;
}

/**
 * Single item in package contents list
 */
export interface IPackageContentItem {
  /** Object name */
  name: string;
  /** ADT object type (e.g., 'CLAS/OC', 'PROG/P') */
  adtType: string;
  /** Human-readable type name */
  type?: PackageHierarchySupportedType;
  /** Object description */
  description?: string;
  /** Package containing this object */
  packageName: string;
  /** Whether this item is a subpackage */
  isPackage: boolean;
}
