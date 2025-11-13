/**
 * ReadOnlyClient - Read-only operations for SAP ADT
 *
 * Provides methods for retrieving ABAP objects and data without modification.
 * All methods return raw AxiosResponse - no MCP formatting.
 *
 * All implementations are in core/readOperations.ts to avoid code duplication.
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import * as readOps from '../core/readOperations';

export class ReadOnlyClient {
  constructor(protected connection: AbapConnection) {}

  /**
   * Get ABAP program source code
   */
  async getProgram(programName: string): Promise<AxiosResponse> {
    return readOps.getProgram(this.connection, programName);
  }

  /**
   * Get ABAP class source code
   */
  async getClass(className: string): Promise<AxiosResponse> {
    return readOps.getClass(this.connection, className);
  }

  /**
   * Get ABAP table structure
   */
  async getTable(tableName: string): Promise<AxiosResponse> {
    return readOps.getTable(this.connection, tableName);
  }

  /**
   * Get ABAP structure
   */
  async getStructure(structureName: string): Promise<AxiosResponse> {
    return readOps.getStructure(this.connection, structureName);
  }

  /**
   * Get ABAP domain
   */
  async getDomain(domainName: string): Promise<AxiosResponse> {
    return readOps.getDomain(this.connection, domainName);
  }

  /**
   * Get ABAP data element
   */
  async getDataElement(dataElementName: string): Promise<AxiosResponse> {
    return readOps.getDataElement(this.connection, dataElementName);
  }

  /**
   * Get ABAP interface
   */
  async getInterface(interfaceName: string): Promise<AxiosResponse> {
    return readOps.getInterface(this.connection, interfaceName);
  }

  /**
   * Get ABAP function group
   */
  async getFunctionGroup(functionGroupName: string): Promise<AxiosResponse> {
    return readOps.getFunctionGroup(this.connection, functionGroupName);
  }

  /**
   * Get ABAP function module
   */
  async getFunction(functionName: string, functionGroup: string): Promise<AxiosResponse> {
    return readOps.getFunction(this.connection, functionName, functionGroup);
  }

  /**
   * Get ABAP package
   */
  async getPackage(packageName: string): Promise<AxiosResponse> {
    return readOps.getPackage(this.connection, packageName);
  }

  /**
   * Get ABAP view (CDS or Classic)
   */
  async getView(viewName: string): Promise<AxiosResponse> {
    return readOps.getView(this.connection, viewName);
  }

  /**
   * Fetch node structure from SAP ADT repository
   */
  async fetchNodeStructure(
    parentName: string,
    parentTechName: string,
    parentType: string,
    nodeKey: string,
    withShortDescriptions: boolean = true
  ): Promise<AxiosResponse> {
    return readOps.fetchNodeStructure(this.connection, parentName, parentTechName, parentType, nodeKey, withShortDescriptions);
  }

  /**
   * Get system information from SAP ADT (for cloud systems)
   */
  async getSystemInformation(): Promise<{ systemID?: string; userName?: string } | null> {
    return readOps.getSystemInformation(this.connection);
  }

  // TODO: Add more read-only methods as needed
  // All will delegate to core/readOperations.ts
}

