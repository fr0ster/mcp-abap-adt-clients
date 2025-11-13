/**
 * CrudClient - Full CRUD operations for SAP ADT
 *
 * Extends ReadOnlyClient with Create, Update, and Delete operations.
 * All methods return raw AxiosResponse - no MCP formatting.
 *
 * All implementations are in core/crudOperations.ts to avoid code duplication.
 * Read operations are inherited from ReadOnlyClient (which delegates to core/readOperations.ts).
 */

import { ReadOnlyClient } from './ReadOnlyClient';
import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import * as crudOps from '../core/crudOperations';

export class CrudClient extends ReadOnlyClient {
  constructor(connection: AbapConnection) {
    super(connection);
  }

  // TODO: Add CRUD methods that delegate to core/crudOperations.ts
  // Create methods:
  // async createProgram(params: CreateProgramParams): Promise<AxiosResponse> {
  //   return crudOps.createProgram(this.connection, params);
  // }

  // Update methods:
  // async updateProgramSource(name: string, source: string, transportRequest?: string): Promise<AxiosResponse> {
  //   return crudOps.updateProgramSource(this.connection, name, source, transportRequest);
  // }

  // Delete methods:
  // async deleteObject(name: string, type: string, transportRequest?: string): Promise<AxiosResponse> {
  //   return crudOps.deleteObject(this.connection, name, type, transportRequest);
  // }
}

