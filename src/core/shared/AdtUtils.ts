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
import { ILogger } from '../../utils/logger';
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
}
