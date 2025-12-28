/**
 * AdtUtils - Utility Functions Wrapper
 *
 * Provides access to cross-cutting ADT utility functions that are NOT CRUD operations.
 * These functions don't implement IAdtObject interface because they are not object-specific CRUD operations.
 *
 * Utility functions include:
 * - Search operations
 * - Where-used analysis
 * - Inactive objects management
 * - Group activation/deletion
 * - Object metadata and source code reading
 * - SQL queries and table contents
 *
 * Usage:
 * ```typescript
 * const client = new AdtClient(connection, logger);
 * const utils = client.getUtils();
 *
 * // Search for objects
 * const searchResult = await utils.searchObjects({ query: 'Z*', objectType: 'CLAS' });
 *
 * // Get where-used references
 * const whereUsed = await utils.getWhereUsed({ objectName: 'ZMY_CLASS', objectType: 'CLAS' });
 *
 * // Group activation
 * await utils.activateObjectsGroup([{ type: 'DOMA', name: 'ZMY_DOMAIN' }]);
 * ```
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { readSource as readBehaviorDefinitionSource } from '../behaviorDefinition/read';
import { getEnhancementMetadata } from '../enhancement/read';
import { getPackageContents } from '../package/read';
import { getAllTypes as getAllTypesUtil } from './allTypes';
import { getDiscovery as getDiscoveryUtil } from './discovery';
import { getEnhancementImpl as getEnhancementImplUtil } from './enhancementImpl';
import { getEnhancements } from './enhancements';
import { getInactiveObjects } from './getInactiveObjects';
import { activateObjectsGroup } from './groupActivation';
import { checkDeletionGroup, deleteObjectsGroup } from './groupDeletion';
import { getInclude as getIncludeUtil } from './include';
import { getIncludesList } from './includesList';
import { fetchNodeStructure as fetchNodeStructureUtil } from './nodeStructure';
import { getObjectStructure as getObjectStructureUtil } from './objectStructure';
import { getPackageHierarchy } from './packageHierarchy';
// Import utility functions
import { searchObjects } from './search';
import { getSqlQuery } from './sqlQuery';
import { getTableContents } from './tableContents';
import { getTransaction } from './transaction';
import { getTypeInfo as getTypeInfoUtil } from './typeInfo';
import { getVirtualFoldersContents } from './virtualFolders';
import {
  getWhereUsed,
  getWhereUsedScope,
  modifyWhereUsedScope,
} from './whereUsed';
// Note: Application Logs and ATC Logs are in runtime/, not core
// They are accessed via AdtRuntime, not AdtUtils

// Note: DDIC Activation Graph is in runtime/logs/ddic.ts
// It is accessed via AdtRuntime.getDdicActivationGraph(), not AdtUtils

// Import types
import type {
  AdtObjectType,
  AdtSourceObjectType,
  IGetDiscoveryParams,
  IGetPackageHierarchyOptions,
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IGetVirtualFoldersContentsParams,
  IGetWhereUsedParams,
  IGetWhereUsedScopeParams,
  IInactiveObjectsResponse,
  IObjectReference,
  IPackageHierarchyNode,
  IReadOptions,
  ISearchObjectsParams,
} from './types';

export class AdtUtils {
  private connection: IAbapConnection;
  private logger: ILogger;

  constructor(connection: IAbapConnection, logger: ILogger) {
    this.connection = connection;
    this.logger = logger;
  }

  /**
   * Search for ABAP objects by name pattern
   *
   * @param params - Search parameters
   * @returns Search results
   */
  async searchObjects(params: ISearchObjectsParams): Promise<AxiosResponse> {
    return searchObjects(this.connection, params);
  }

  /**
   * Fetch virtual folder contents for hierarchical browsing.
   *
   * @param params - Virtual folder request parameters
   * @returns Virtual folder contents in XML format
   */
  async getVirtualFoldersContents(
    params: IGetVirtualFoldersContentsParams,
  ): Promise<AxiosResponse> {
    return getVirtualFoldersContents(this.connection, params);
  }

  /**scope configuration (Step 1: prepare search)
   *
   * Returns available object types that can be searched for where-used references.
   * Consumer can parse the XML response, present options to user, and modify selections.
   *
   * @param params - Scope parameters
   * @returns Scope XML with available object types (isSelected, isDefault attributes)
   *
   * @example
   * // Get scope for a class
   * const scopeResponse = await utils.getWhereUsedScope({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class'
   * });
   *
   * // Parse and display types to user, then modify XML
   * let scopeXml = scopeResponse.data;
   * // Enable function modules in search
   * scopeXml = scopeXml.replace(/name="FUGR\/FF" isSelected="false"/, 'name="FUGR/FF" isSelected="true"');
   *
   * // Execute search with modified scope
   * const result = await utils.getWhereUsed({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class',
   *   scopeXml: scopeXml
   * });
   */
  async getWhereUsedScope(
    params: IGetWhereUsedScopeParams,
  ): Promise<AxiosResponse> {
    return getWhereUsedScope(this.connection, params);
  }

  /**
   * Modify where-used scope to enable/disable object types
   *
   * Helper function to modify isSelected flags in scope XML before executing search.
   *
   * @param scopeXml - Scope XML from getWhereUsedScope()
   * @param options - Modification options
   * @returns Modified scope XML
   *
   * @example
   * const scopeResponse = await utils.getWhereUsedScope({ object_name: 'ZMY_CLASS', object_type: 'class' });
   * let scopeXml = scopeResponse.data;
   *
   * // Enable function modules in search
   * scopeXml = utils.modifyWhereUsedScope(scopeXml, { enable: ['FUGR/FF'] });
   *
   * // Search only in classes and interfaces
   * scopeXml = utils.modifyWhereUsedScope(scopeXml, { enableOnly: ['CLAS/OC', 'INTF/OI'] });
   *
   * const result = await utils.getWhereUsed({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class',
   *   scopeXml: scopeXml
   * });
   */
  modifyWhereUsedScope(
    scopeXml: string,
    options: {
      enableAll?: boolean;
      enableOnly?: string[];
      enable?: string[];
      disable?: string[];
    },
  ): string {
    return modifyWhereUsedScope(scopeXml, options);
  }

  /**
   * Get where-used references for ABAP object (Step 2: execute search)
   *
   * This function performs a two-step ADT operation:
   * 1. Fetches scope configuration (if not provided)
   * 2. Executes where-used search with the scope
   *
   * @param params - Where-used parameters
   * @param params.object_name - Name of the object to search
   * @param params.object_type - Type of the object (class, table, etc.)
   * @param params.scopeXml - Optional scope XML from getWhereUsedScope(). If not provided, uses default SAP selection.
   * @returns Where-used references in XML format
   *
   * @example
   * // Simple usage with default scope
   * const result = await utils.getWhereUsed({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class'
   * });
   *
   * // Advanced: use custom scope from getWhereUsedScope()
   * const scopeResponse = await utils.getWhereUsedScope({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class'
   * });
   * let scopeXml = scopeResponse.data;
   * // Modify selections...
   * const result = await utils.getWhereUsed({
   *   object_name: 'ZMY_CLASS',
   *   object_type: 'class',
   *   scopeXml: scopeXml
   *   searchInAllTypes: ['CLAS/OC', 'INTF/OI']
   * });
   */
  async getWhereUsed(params: IGetWhereUsedParams): Promise<AxiosResponse> {
    return getWhereUsed(this.connection, params);
  }

  /**
   * Get list of inactive objects (objects that are not yet activated)
   *
   * @param options - Optional parameters
   * @returns List of inactive objects with their metadata
   */
  async getInactiveObjects(options?: {
    includeRawXml?: boolean;
  }): Promise<IInactiveObjectsResponse> {
    return getInactiveObjects(this.connection, options);
  }

  /**
   * Activate multiple objects in a group
   *
   * @param objects - Array of object references to activate
   * @param preauditRequested - Whether to request pre-audit
   * @returns Activation result
   */
  async activateObjectsGroup(
    objects: IObjectReference[],
    preauditRequested: boolean = false,
  ): Promise<AxiosResponse> {
    return activateObjectsGroup(this.connection, objects, preauditRequested);
  }

  /**
   * Check if multiple objects can be deleted (group deletion check)
   *
   * @param objects - Array of object references to check
   * @returns Check result
   */
  async checkDeletionGroup(
    objects: IObjectReference[],
  ): Promise<AxiosResponse> {
    return checkDeletionGroup(this.connection, objects);
  }

  /**
   * Delete multiple objects in a group
   *
   * @param objects - Array of object references to delete
   * @param transportRequest - Optional transport request
   * @returns Delete result
   */
  async deleteObjectsGroup(
    objects: IObjectReference[],
    transportRequest?: string,
  ): Promise<AxiosResponse> {
    return deleteObjectsGroup(this.connection, objects, transportRequest);
  }

  /**
   * Read object metadata (without source code)
   *
   * @param objectType - Object type (e.g., 'CLAS', 'PROG', 'INTF')
   * @param objectName - Object name
   * @param functionGroup - Function group (required for function modules)
   * @param options - Optional read options
   * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
   * @param options.accept - Optional Accept override for the metadata request
   * @returns Metadata response
   */
  async readObjectMetadata(
    objectType: AdtObjectType,
    objectName: string,
    functionGroup?: string,
    options?: IReadOptions,
  ): Promise<AxiosResponse> {
    let uri = getObjectMetadataUri(objectType, objectName, functionGroup);
    if (options?.withLongPolling) {
      uri += '?withLongPolling=true';
    }
    const acceptHeader = options?.accept ?? getMetadataAcceptHeader(objectType);
    return makeAdtRequestWithAcceptNegotiation(
      this.connection,
      {
        url: uri,
        method: 'GET',
        timeout: getTimeout('default'),
        headers: {
          Accept: acceptHeader,
        },
      },
      {
        logger: this.logger,
      },
    );
  }

  /**
   * Read object source code
   * Only works for objects that have source code (class, program, interface, etc.)
   *
   * @param objectType - Object type (e.g., 'CLAS', 'PROG', 'INTF')
   * @param objectName - Object name
   * @param functionGroup - Function group (required for function modules)
   * @param version - 'active' or 'inactive'
   * @param options - Optional read options
   * @param options.withLongPolling - If true, adds ?withLongPolling=true to wait for object to become available
   * @param options.accept - Optional Accept override for the source request
   * @returns Source code response
   */
  async readObjectSource(
    objectType: AdtSourceObjectType,
    objectName: string,
    functionGroup?: string,
    version: 'active' | 'inactive' = 'active',
    options?: IReadOptions,
  ): Promise<AxiosResponse> {
    if (!supportsSourceCode(objectType)) {
      throw new Error(
        `Object type ${objectType} does not support source code reading`,
      );
    }

    let uri = getObjectSourceUri(
      objectType,
      objectName,
      functionGroup,
      version,
    );
    if (options?.withLongPolling) {
      const separator = uri.includes('?') ? '&' : '?';
      uri += `${separator}withLongPolling=true`;
    }

    const acceptHeader = options?.accept ?? 'text/plain';
    return makeAdtRequestWithAcceptNegotiation(
      this.connection,
      {
        url: uri,
        method: 'GET',
        timeout: getTimeout('default'),
        headers: {
          Accept: acceptHeader,
        },
      },
      {
        logger: this.logger,
      },
    );
  }

  /**
   * Check if object type supports source code reading
   *
   * @param objectType - Object type to check
   * @returns true if object type supports source code reading
   */
  supportsSourceCode(objectType: AdtObjectType): boolean {
    return supportsSourceCode(objectType);
  }

  /**
   * Get object source URI based on object type
   *
   * @param objectType - Object type
   * @param objectName - Object name
   * @param functionGroup - Function group (required for function modules)
   * @param version - 'active' or 'inactive'
   * @returns Source URI
   */
  getObjectSourceUri(
    objectType: AdtSourceObjectType,
    objectName: string,
    functionGroup?: string,
    version: 'active' | 'inactive' = 'active',
  ): string {
    return getObjectSourceUri(objectType, objectName, functionGroup, version);
  }

  /**
   * Execute SQL query via ADT Data Preview API
   * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
   *
   * @param params - SQL query parameters
   * @returns Query result
   */
  async getSqlQuery(params: IGetSqlQueryParams): Promise<AxiosResponse> {
    return getSqlQuery(this.connection, params);
  }

  /**
   * Get table contents via ADT Data Preview API
   * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
   *
   * @param params - Table contents parameters
   * @returns Table contents result
   */
  async getTableContents(
    params: IGetTableContentsParams,
  ): Promise<AxiosResponse> {
    return getTableContents(this.connection, params);
  }

  /**
   * Fetch ADT discovery document with endpoint catalog
   *
   * @param params - Optional request/timeout options
   * @returns Axios response with discovery XML
   */
  async discovery(params: IGetDiscoveryParams = {}): Promise<AxiosResponse> {
    return getDiscoveryUtil(this.connection, params);
  }

  /**
   * Get transaction properties (metadata) for ABAP transaction
   *
   * Retrieves transaction information using ADT object properties endpoint:
   * - Transaction name
   * - Description
   * - Package (if applicable)
   * - Transaction type
   *
   * @param transactionName - Transaction code (e.g., 'SE80', 'SE11', 'SM30')
   * @returns Axios response with XML containing transaction properties
   *          Response format: opr:objectProperties with opr:object containing
   *          name, text (description), package, type
   *
   * @example
   * ```typescript
   * const response = await utils.getTransaction('SE80');
   * // Response contains XML with transaction properties
   * ```
   */
  async getTransaction(transactionName: string): Promise<AxiosResponse> {
    return getTransaction(this.connection, transactionName);
  }

  /**
   * Get behavior definition source code (BDEF)
   *
   * Convenience wrapper for reading behavior definition source code.
   * Uses the same endpoint as `AdtClient.getBehaviorDefinition().read()`.
   *
   * @param bdefName - Behavior definition name (e.g., 'Z_I_MYENTITY')
   * @param version - Version to read: 'active' or 'inactive' (default: 'active')
   * @returns Axios response with source code (plain text)
   *
   * @example
   * ```typescript
   * const response = await utils.getBdef('Z_I_MYENTITY');
   * const sourceCode = response.data; // BDEF source code
   * ```
   */
  async getBdef(
    bdefName: string,
    version: 'active' | 'inactive' = 'active',
  ): Promise<AxiosResponse> {
    return readBehaviorDefinitionSource(this.connection, bdefName, version);
  }

  /**
   * Fetch node structure from ADT repository
   *
   * Used for object tree navigation and structure discovery.
   *
   * @param parentType - Parent object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
   * @param parentName - Parent object name
   * @param nodeId - Optional node ID (default: '0000' for root)
   * @param withShortDescriptions - Include short descriptions (default: true)
   * @returns Axios response with XML containing node structure
   *
   * @example
   * ```typescript
   * const response = await utils.fetchNodeStructure('CLAS/OC', 'ZMY_CLASS', '0000');
   * ```
   */
  async fetchNodeStructure(
    parentType: string,
    parentName: string,
    nodeId?: string,
    withShortDescriptions: boolean = true,
  ): Promise<AxiosResponse> {
    return fetchNodeStructureUtil(
      this.connection,
      parentType,
      parentName,
      nodeId,
      withShortDescriptions,
    );
  }

  /**
   * Get enhancement implementations for ABAP object
   *
   * Retrieves enhancement implementations for programs, includes, or classes.
   *
   * @param objectName - Object name (program, include, or class)
   * @param objectType - Object type: 'program' | 'include' | 'class'
   * @param context - Optional program context for includes (required when objectType is 'include')
   * @returns Axios response with XML containing enhancement implementations
   *
   * @example
   * ```typescript
   * // For a program
   * const response = await utils.getEnhancements('ZMY_PROGRAM', 'program');
   *
   * // For an include
   * const response = await utils.getEnhancements('ZMY_INCLUDE', 'include', 'ZMY_PROGRAM');
   *
   * // For a class
   * const response = await utils.getEnhancements('ZMY_CLASS', 'class');
   * ```
   */
  async getEnhancements(
    objectName: string,
    objectType: 'program' | 'include' | 'class',
    context?: string,
  ): Promise<AxiosResponse> {
    return getEnhancements(this.connection, objectName, objectType, context);
  }

  /**
   * Get list of includes for ABAP object
   *
   * Recursively discovers and lists all include files within an ABAP program or include.
   *
   * @param objectName - Object name (program or include)
   * @param objectType - Object type: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC'
   * @param timeout - Optional timeout in milliseconds (default: 30000)
   * @returns Array of include names
   *
   * @example
   * ```typescript
   * const includes = await utils.getIncludesList('ZMY_PROGRAM', 'PROG/P');
   * // Returns: ['ZMY_INCLUDE1', 'ZMY_INCLUDE2', ...]
   * ```
   */
  async getIncludesList(
    objectName: string,
    objectType: 'PROG/P' | 'PROG/I' | 'FUGR' | 'CLAS/OC',
    timeout: number = 30000,
  ): Promise<string[]> {
    return getIncludesList(this.connection, objectName, objectType, timeout);
  }

  /**
   * Get package contents (list of objects in package)
   *
   * Retrieves all objects contained in an ABAP package.
   *
   * @param packageName - Package name
   * @returns Axios response with XML containing package contents
   *
   * @example
   * ```typescript
   * const response = await utils.getPackageContents('ZMY_PACKAGE');
   * // Response contains XML with objects in the package
   * ```
   */
  async getPackageContents(packageName: string): Promise<AxiosResponse> {
    return getPackageContents(this.connection, packageName);
  }

  /**
   * Get package hierarchy as a tree structure
   *
   * Builds a tree of package contents and subpackages using node structure.
   *
   * @param packageName - Package name
   * @param options - Optional hierarchy options
   * @returns Root tree node for the package hierarchy
   *
   * @example
   * ```typescript
   * const tree = await utils.getPackageHierarchy('ZMY_PACKAGE', {
   *   includeSubpackages: true,
   *   maxDepth: 5,
   *   includeDescriptions: true,
   * });
   * // tree contains package, subpackages, and objects in a hierarchy
   * ```
   */
  async getPackageHierarchy(
    packageName: string,
    options?: IGetPackageHierarchyOptions,
  ): Promise<IPackageHierarchyNode> {
    return getPackageHierarchy(
      this.connection,
      packageName,
      options,
      this.logger,
    );
  }

  /**
   * Get object structure from ADT repository
   *
   * Retrieves ADT object structure as compact JSON tree.
   *
   * @param objectType - Object type (e.g., 'CLAS/OC', 'PROG/P', 'DEVC/K')
   * @param objectName - Object name
   * @returns Axios response with XML containing object structure tree
   *
   * @example
   * ```typescript
   * const response = await utils.getObjectStructure('CLAS/OC', 'ZMY_CLASS');
   * ```
   */
  async getObjectStructure(
    objectType: string,
    objectName: string,
  ): Promise<AxiosResponse> {
    return getObjectStructureUtil(this.connection, objectType, objectName);
  }

  /**
   * Get include source code
   *
   * Retrieves source code of specific ABAP include file.
   *
   * @param includeName - Include name
   * @returns Axios response with source code (plain text)
   *
   * @example
   * ```typescript
   * const response = await utils.getInclude('ZMY_INCLUDE');
   * const sourceCode = response.data; // Include source code
   * ```
   */
  async getInclude(includeName: string): Promise<AxiosResponse> {
    return getIncludeUtil(this.connection, includeName);
  }

  /**
   * Get type information with fallback chain
   *
   * Tries multiple endpoints in order: domain, data element, table type, object properties.
   *
   * @param typeName - Type name to look up
   * @returns Axios response with type information (XML)
   *
   * @example
   * ```typescript
   * const response = await utils.getTypeInfo('ZMY_TYPE');
   * ```
   */
  async getTypeInfo(typeName: string): Promise<AxiosResponse> {
    return getTypeInfoUtil(this.connection, typeName);
  }

  /**
   * Get enhancement implementation source code
   *
   * Uses different URL format: /sap/bc/adt/enhancements/{spot}/{name}/source/main
   * where spot is the enhancement spot name (not type).
   *
   * @param enhancementSpot - Enhancement spot name (e.g., 'enhoxhh')
   * @param enhancementName - Enhancement implementation name
   * @returns Axios response with XML containing enhancement source code
   *
   * @example
   * ```typescript
   * const response = await utils.getEnhancementImpl('enhoxhh', 'zpartner_update_pai');
   * ```
   */
  async getEnhancementImpl(
    enhancementSpot: string,
    enhancementName: string,
  ): Promise<AxiosResponse> {
    return getEnhancementImplUtil(
      this.connection,
      enhancementSpot,
      enhancementName,
    );
  }

  /**
   * Get enhancement spot metadata
   *
   * Convenience wrapper for reading enhancement spot metadata.
   * Uses type 'enhsxsb' (BAdI Enhancement Spot).
   *
   * @param enhancementSpot - Enhancement spot name
   * @returns Axios response with XML containing enhancement spot metadata
   *
   * @example
   * ```typescript
   * const response = await utils.getEnhancementSpot('enhoxhh');
   * ```
   */
  async getEnhancementSpot(enhancementSpot: string): Promise<AxiosResponse> {
    return getEnhancementMetadata(
      this.connection,
      'enhsxsb',
      enhancementSpot,
      undefined,
      this.logger,
    );
  }

  /**
   * Get all valid ADT object types
   *
   * Retrieves list of all valid ADT object types from the repository.
   *
   * @param maxItemCount - Maximum number of items to return (default: 999)
   * @param name - Name filter pattern (default: '*')
   * @param data - Data filter (default: 'usedByProvider')
   * @returns Axios response with XML containing all object types
   *
   * @example
   * ```typescript
   * const response = await utils.getAllTypes();
   * // Response contains XML with all ADT object types
   * ```
   */
  async getAllTypes(
    maxItemCount: number = 999,
    name: string = '*',
    data: string = 'usedByProvider',
  ): Promise<AxiosResponse> {
    return getAllTypesUtil(this.connection, maxItemCount, name, data);
  }
}

function getObjectMetadataUri(
  objectType: AdtObjectType,
  objectName: string,
  functionGroup?: string,
): string {
  const encodedName = encodeSapObjectName(objectName);

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case 'functionmodule':
    case 'fugr/ff': {
      if (!functionGroup) {
        throw new Error('Function group is required for function module');
      }
      const encodedGroup = encodeSapObjectName(functionGroup);
      return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;
    }
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case 'tabletype':
    case 'ttyp/df':
      return `/sap/bc/adt/ddic/tabletypes/${encodedName}`;
    case 'domain':
    case 'doma/dd':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'dataelement':
    case 'dtel':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    case 'functiongroup':
    case 'fugr':
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case 'package':
    case 'devc/k':
      return `/sap/bc/adt/packages/${encodedName}`;
    default:
      throw new Error(`Unsupported object type for metadata: ${objectType}`);
  }
}

function getMetadataAcceptHeader(objectType: AdtObjectType): string {
  const type = objectType.toLowerCase();

  switch (type) {
    case 'class':
    case 'clas/oc':
      return 'application/vnd.sap.adt.oo.classes.v4+xml, application/vnd.sap.adt.oo.classes.v3+xml, application/vnd.sap.adt.oo.classes.v2+xml, application/vnd.sap.adt.oo.classes.v1+xml';
    case 'interface':
    case 'intf/if':
      return 'application/vnd.sap.adt.oo.interfaces.v5+xml, application/vnd.sap.adt.oo.interfaces.v4+xml, application/vnd.sap.adt.oo.interfaces.v3+xml, application/vnd.sap.adt.oo.interfaces.v2+xml, application/vnd.sap.adt.oo.interfaces+xml';
    case 'table':
    case 'tabl/dt':
      return 'application/vnd.sap.adt.blues.v1+xml, application/vnd.sap.adt.tables.v2+xml';
    case 'tabletype':
    case 'ttyp/df':
      return 'application/vnd.sap.adt.tabletypes.v2+xml, application/vnd.sap.adt.tabletypes.v1+xml, application/vnd.sap.adt.blues.v1+xml';
    case 'domain':
    case 'doma/dd':
      return 'application/vnd.sap.adt.domains.v2+xml, application/vnd.sap.adt.domains.v1+xml';
    case 'dataelement':
    case 'dtel':
      return 'application/vnd.sap.adt.dataelements.v2+xml, application/vnd.sap.adt.dataelements.v1+xml';
    case 'structure':
    case 'stru/dt':
      return 'application/vnd.sap.adt.structures.v2+xml, application/vnd.sap.adt.structures.v1+xml';
    case 'view':
    case 'ddls/df':
      return 'application/vnd.sap.adt.ddlSource+xml';
    case 'program':
    case 'prog/p':
      return 'application/vnd.sap.adt.programs.programs.v2+xml, application/vnd.sap.adt.programs.programs.v1+xml';
    case 'functiongroup':
    case 'fugr':
      return 'application/vnd.sap.adt.functions.groups.v2+xml, application/vnd.sap.adt.functions.groups.v1+xml';
    case 'functionmodule':
    case 'fugr/ff':
      return 'application/vnd.sap.adt.functions.fmodules+xml, application/vnd.sap.adt.functions.fmodules.v2+xml, application/vnd.sap.adt.functions.fmodules.v3+xml';
    case 'package':
    case 'devc/k':
      return 'application/vnd.sap.adt.packages.v2+xml, application/vnd.sap.adt.packages.v1+xml';
    default:
      return 'application/xml';
  }
}

function getObjectSourceUri(
  objectType: AdtSourceObjectType,
  objectName: string,
  functionGroup?: string,
  version: 'active' | 'inactive' = 'active',
): string {
  const encodedName = encodeSapObjectName(objectName);
  const versionParam = version === 'inactive' ? '?version=inactive' : '';

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}/source/main${versionParam}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}/source/main`;
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}/source/main${versionParam}`;
    case 'functionmodule':
    case 'fugr/ff': {
      if (!functionGroup) {
        throw new Error('Function group is required for function module');
      }
      const encodedGroup = encodeSapObjectName(functionGroup);
      return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/source/main${versionParam}`;
    }
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}/source/main`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}/source/main`;
    case 'tabletype':
    case 'ttyp/df':
      return `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main`;
    default:
      throw new Error(
        `Object type ${objectType} does not support source code reading`,
      );
  }
}

function supportsSourceCode(objectType: AdtObjectType): boolean {
  const supportedTypes = [
    'class',
    'clas/oc',
    'program',
    'prog/p',
    'interface',
    'intf/if',
    'functionmodule',
    'fugr/ff',
    'view',
    'ddls/df',
    'structure',
    'stru/dt',
    'table',
    'tabl/dt',
    'tabletype',
    'ttyp/df',
  ];
  return supportedTypes.includes(objectType.toLowerCase());
}
