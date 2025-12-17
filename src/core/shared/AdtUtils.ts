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

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';

// Import utility functions
import { searchObjects } from './search';
import { getWhereUsed } from './whereUsed';
import { getInactiveObjects } from './getInactiveObjects';
import { activateObjectsGroup } from './groupActivation';
import { checkDeletionGroup, deleteObjectsGroup } from './groupDeletion';
import { readObjectMetadata } from './readMetadata';
import { readObjectSource, supportsSourceCode, getObjectSourceUri } from './readSource';
import { getSqlQuery } from './sqlQuery';
import { getTableContents } from './tableContents';
import { getTransaction } from './transaction';
import { readSource as readBehaviorDefinitionSource } from '../behaviorDefinition/read';
import { fetchNodeStructure as fetchNodeStructureUtil } from './nodeStructure';
import { getEnhancements } from './enhancements';
import { getIncludesList } from './includesList';
import { getPackageContents } from '../package/read';
import { getObjectStructure as getObjectStructureUtil } from './objectStructure';
import { getInclude as getIncludeUtil } from './include';
import { getTypeInfo as getTypeInfoUtil } from './typeInfo';
import { getEnhancementImpl as getEnhancementImplUtil } from './enhancementImpl';
import { getEnhancementMetadata } from '../enhancement/read';

// Import types
import type {
  ISearchObjectsParams,
  IGetWhereUsedParams,
  IGetSqlQueryParams,
  IGetTableContentsParams,
  IObjectReference,
  IInactiveObjectsResponse
} from './types';

export class AdtUtils {
  private connection: IAbapConnection;
  private logger: ILogger;

  constructor(
    connection: IAbapConnection,
    logger: ILogger
  ) {
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
   * Get where-used references for ABAP object
   * 
   * @param params - Where-used parameters
   * @returns Where-used references
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
    preauditRequested: boolean = false
  ): Promise<AxiosResponse> {
    return activateObjectsGroup(this.connection, objects, preauditRequested);
  }

  /**
   * Check if multiple objects can be deleted (group deletion check)
   * 
   * @param objects - Array of object references to check
   * @returns Check result
   */
  async checkDeletionGroup(objects: IObjectReference[]): Promise<AxiosResponse> {
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
    transportRequest?: string
  ): Promise<AxiosResponse> {
    return deleteObjectsGroup(this.connection, objects, transportRequest);
  }

  /**
   * Read object metadata (without source code)
   * 
   * @param objectType - Object type (e.g., 'CLAS', 'PROG', 'INTF')
   * @param objectName - Object name
   * @param functionGroup - Function group (required for function modules)
   * @returns Metadata response
   */
  async readObjectMetadata(
    objectType: string,
    objectName: string,
    functionGroup?: string
  ): Promise<AxiosResponse> {
    return readObjectMetadata(this.connection, objectType, objectName, functionGroup);
  }

  /**
   * Read object source code
   * Only works for objects that have source code (class, program, interface, etc.)
   * 
   * @param objectType - Object type (e.g., 'CLAS', 'PROG', 'INTF')
   * @param objectName - Object name
   * @param functionGroup - Function group (required for function modules)
   * @param version - 'active' or 'inactive'
   * @returns Source code response
   */
  async readObjectSource(
    objectType: string,
    objectName: string,
    functionGroup?: string,
    version: 'active' | 'inactive' = 'active'
  ): Promise<AxiosResponse> {
    return readObjectSource(this.connection, objectType, objectName, functionGroup, version);
  }

  /**
   * Check if object type supports source code reading
   * 
   * @param objectType - Object type to check
   * @returns true if object type supports source code reading
   */
  supportsSourceCode(objectType: string): boolean {
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
    objectType: string,
    objectName: string,
    functionGroup?: string,
    version: 'active' | 'inactive' = 'active'
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
  async getTableContents(params: IGetTableContentsParams): Promise<AxiosResponse> {
    return getTableContents(this.connection, params);
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
  async getBdef(bdefName: string, version: 'active' | 'inactive' = 'active'): Promise<AxiosResponse> {
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
    withShortDescriptions: boolean = true
  ): Promise<AxiosResponse> {
    return fetchNodeStructureUtil(this.connection, parentType, parentName, nodeId, withShortDescriptions);
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
    context?: string
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
    timeout: number = 30000
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
  async getObjectStructure(objectType: string, objectName: string): Promise<AxiosResponse> {
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
  async getEnhancementImpl(enhancementSpot: string, enhancementName: string): Promise<AxiosResponse> {
    return getEnhancementImplUtil(this.connection, enhancementSpot, enhancementName);
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
    return getEnhancementMetadata(this.connection, 'enhsxsb', enhancementSpot);
  }
}
