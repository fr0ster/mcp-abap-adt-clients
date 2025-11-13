/**
 * ReadOnlyClient - Read-only operations for SAP ADT
 *
 * Provides methods for retrieving ABAP objects and data without modification.
 * All methods return raw AxiosResponse - no MCP formatting.
 *
 * All implementations are in core/{object}/read.ts modules.
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import * as programRead from '../core/program/read';
import * as classRead from '../core/class/read';
import * as domainRead from '../core/domain/read';
import * as dataElementRead from '../core/dataElement/read';
import * as interfaceRead from '../core/interface/read';
import * as tableRead from '../core/table/read';
import * as structureRead from '../core/structure/read';
import * as viewRead from '../core/view/read';
import * as functionGroupRead from '../core/functionGroup/read';
import * as functionModuleRead from '../core/functionModule/read';
import * as packageRead from '../core/package/read';
import * as readOps from '../core/readOperations'; // For remaining operations (fetchNodeStructure, getSystemInformation)

export class ReadOnlyClient {
  constructor(protected connection: AbapConnection) {}

  /**
   * Get ABAP program source code
   */
  async getProgram(programName: string): Promise<AxiosResponse> {
    return programRead.getProgram(this.connection, programName);
  }

  /**
   * Get ABAP class source code
   */
  async getClass(className: string): Promise<AxiosResponse> {
    return classRead.getClass(this.connection, className);
  }

  /**
   * Get ABAP table structure
   */
  async getTable(tableName: string): Promise<AxiosResponse> {
    return tableRead.getTable(this.connection, tableName);
  }

  /**
   * Get ABAP structure
   */
  async getStructure(structureName: string): Promise<AxiosResponse> {
    return structureRead.getStructure(this.connection, structureName);
  }

  /**
   * Get ABAP domain
   */
  async getDomain(domainName: string): Promise<AxiosResponse> {
    return domainRead.getDomain(this.connection, domainName);
  }

  /**
   * Get ABAP data element
   */
  async getDataElement(dataElementName: string): Promise<AxiosResponse> {
    return dataElementRead.getDataElement(this.connection, dataElementName);
  }

  /**
   * Get ABAP interface
   */
  async getInterface(interfaceName: string): Promise<AxiosResponse> {
    return interfaceRead.getInterface(this.connection, interfaceName);
  }

  /**
   * Get ABAP function group
   */
  async getFunctionGroup(functionGroupName: string): Promise<AxiosResponse> {
    return functionGroupRead.getFunctionGroup(this.connection, functionGroupName);
  }

  /**
   * Get ABAP function module
   */
  async getFunction(functionName: string, functionGroup: string): Promise<AxiosResponse> {
    return functionModuleRead.getFunction(this.connection, functionName, functionGroup);
  }

  /**
   * Get ABAP package
   */
  async getPackage(packageName: string): Promise<AxiosResponse> {
    return packageRead.getPackage(this.connection, packageName);
  }

  /**
   * Get ABAP view (CDS or Classic)
   */
  async getView(viewName: string): Promise<AxiosResponse> {
    return viewRead.getView(this.connection, viewName);
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
}

