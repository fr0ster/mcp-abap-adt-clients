/**
 * SharedBuilder - Cross-cutting ADT operations
 * 
 * Provides access to operations that don't belong to specific object types:
 * - Search operations
 * - Where-used analysis
 * - Inactive objects management
 * - Group activation
 * - Object metadata and source code reading
 * - SQL queries and table contents
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { getInactiveObjects } from './getInactiveObjects';
import { activateObjectsGroup } from './groupActivation';
import { readObjectMetadata } from './readMetadata';
import { readObjectSource, supportsSourceCode } from './readSource';
import { searchObjects } from './search';
import { getSqlQuery } from './sqlQuery';
import { getTableContents } from './tableContents';
import { getWhereUsed } from './whereUsed';
import {
  InactiveObjectsResponse,
  ObjectReference,
  SearchObjectsParams,
  GetSqlQueryParams,
  GetTableContentsParams,
  GetWhereUsedParams
} from './types';

interface SharedBuilderState {
  searchResult?: AxiosResponse;
  inactiveObjects?: InactiveObjectsResponse;
  activateResult?: AxiosResponse;
  metadataResult?: AxiosResponse;
  sourceResult?: AxiosResponse;
  whereUsedResult?: AxiosResponse;
  sqlQueryResult?: AxiosResponse;
  tableContentsResult?: AxiosResponse;
}

/**
 * SharedBuilder provides access to cross-cutting ADT operations
 */
export class SharedBuilder {
  protected connection: AbapConnection;
  private state: SharedBuilderState = {};

  constructor(connection: AbapConnection) {
    this.connection = connection;
  }

  // State getters
  getState(): SharedBuilderState {
    return this.state;
  }

  getSearchResult(): AxiosResponse | undefined {
    return this.state.searchResult;
  }

  getInactiveObjects(): InactiveObjectsResponse | undefined {
    return this.state.inactiveObjects;
  }

  getActivateResult(): AxiosResponse | undefined {
    return this.state.activateResult;
  }

  getMetadataResult(): AxiosResponse | undefined {
    return this.state.metadataResult;
  }

  getSourceResult(): AxiosResponse | undefined {
    return this.state.sourceResult;
  }

  getWhereUsedResult(): AxiosResponse | undefined {
    return this.state.whereUsedResult;
  }

  getSqlQueryResult(): AxiosResponse | undefined {
    return this.state.sqlQueryResult;
  }

  getTableContentsResult(): AxiosResponse | undefined {
    return this.state.tableContentsResult;
  }

  /**
   * Search for ABAP objects by name pattern
   */
  async search(params: SearchObjectsParams): Promise<this> {
    this.state.searchResult = await searchObjects(this.connection, params);
    return this;
  }

  /**
   * Get list of inactive objects (not yet activated)
   */
  async listInactiveObjects(includeRawXml: boolean = false): Promise<this> {
    this.state.inactiveObjects = await getInactiveObjects(this.connection, { includeRawXml });
    return this;
  }

  /**
   * Activate multiple objects in a group
   */
  async activateGroup(objects: ObjectReference[], preauditRequested: boolean = false): Promise<this> {
    this.state.activateResult = await activateObjectsGroup(this.connection, objects, preauditRequested);
    return this;
  }

  /**
   * Read object metadata (without source code)
   */
  async readMetadata(objectType: string, objectName: string, functionGroup?: string): Promise<this> {
    this.state.metadataResult = await readObjectMetadata(this.connection, objectType, objectName, functionGroup);
    return this;
  }

  /**
   * Read object source code
   */
  async readSource(
    objectType: string, 
    objectName: string, 
    functionGroup?: string,
    version: 'active' | 'inactive' = 'active'
  ): Promise<this> {
    this.state.sourceResult = await readObjectSource(this.connection, objectType, objectName, functionGroup, version);
    return this;
  }

  /**
   * Check if object type supports source code reading
   */
  supportsSource(objectType: string): boolean {
    return supportsSourceCode(objectType);
  }

  /**
   * Get where-used list for an object
   */
  async whereUsed(params: GetWhereUsedParams): Promise<this> {
    this.state.whereUsedResult = await getWhereUsed(this.connection, params);
    return this;
  }

  /**
   * Execute SQL query via ADT Data Preview API
   * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
   */
  async sqlQuery(params: GetSqlQueryParams): Promise<this> {
    this.state.sqlQueryResult = await getSqlQuery(this.connection, params);
    return this;
  }

  /**
   * Get table contents via ADT Data Preview API
   * ⚠️ ABAP Cloud Limitation: Only works on on-premise systems with basic auth
   */
  async tableContents(params: GetTableContentsParams): Promise<this> {
    this.state.tableContentsResult = await getTableContents(this.connection, params);
    return this;
  }
}
