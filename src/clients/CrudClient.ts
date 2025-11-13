/**
 * CrudClient - Full CRUD operations for SAP ADT
 *
 * Extends ReadOnlyClient with Create, Update, and Delete operations.
 * All methods return raw AxiosResponse - no MCP formatting.
 *
 * All implementations are in core/{object}/ modules (e.g., core/program/, core/class/).
 * Read operations are inherited from ReadOnlyClient (which delegates to core/{object}/read.ts).
 */

import { ReadOnlyClient } from './ReadOnlyClient';
import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import * as programOps from '../core/program';
import * as classOps from '../core/class';
import * as domainOps from '../core/domain';
import * as dataElementOps from '../core/dataElement';
import * as interfaceOps from '../core/interface';
import * as tableOps from '../core/table';
import * as structureOps from '../core/structure';
import * as viewOps from '../core/view';
import * as functionGroupOps from '../core/functionGroup';
import * as functionModuleOps from '../core/functionModule';
import * as packageOps from '../core/package';
import * as transportOps from '../core/transport';
import * as deleteOps from '../core/delete';

export class CrudClient extends ReadOnlyClient {
  constructor(connection: AbapConnection) {
    super(connection);
  }

  // Program operations
  async createProgram(params: programOps.CreateProgramParams): Promise<AxiosResponse> {
    return programOps.createProgram(this.connection, params);
  }

  async updateProgramSource(params: programOps.UpdateProgramSourceParams): Promise<AxiosResponse> {
    return programOps.updateProgramSource(this.connection, params);
  }

  // Class operations
  async createClass(params: classOps.CreateClassParams): Promise<AxiosResponse> {
    return classOps.createClass(this.connection, params);
  }

  async updateClassSource(params: classOps.UpdateClassSourceParams): Promise<AxiosResponse> {
    return classOps.updateClassSource(this.connection, params);
  }

  // Domain operations
  async createDomain(params: domainOps.CreateDomainParams): Promise<AxiosResponse> {
    return domainOps.createDomain(this.connection, params);
  }

  async updateDomain(params: domainOps.UpdateDomainParams): Promise<AxiosResponse> {
    return domainOps.updateDomain(this.connection, params);
  }

  // DataElement operations
  async createDataElement(params: dataElementOps.CreateDataElementParams): Promise<AxiosResponse> {
    return dataElementOps.createDataElement(this.connection, params);
  }

  async updateDataElement(params: dataElementOps.UpdateDataElementParams): Promise<AxiosResponse> {
    return dataElementOps.updateDataElement(this.connection, params);
  }

  // Interface operations
  async createInterface(params: interfaceOps.CreateInterfaceParams): Promise<AxiosResponse> {
    return interfaceOps.createInterface(this.connection, params);
  }

  async updateInterfaceSource(params: interfaceOps.UpdateInterfaceSourceParams): Promise<AxiosResponse> {
    return interfaceOps.updateInterfaceSource(this.connection, params);
  }

  // Table operations
  async createTable(params: tableOps.CreateTableParams): Promise<AxiosResponse> {
    return tableOps.createTable(this.connection, params);
  }

  // Structure operations
  async createStructure(params: structureOps.CreateStructureParams): Promise<AxiosResponse> {
    return structureOps.createStructure(this.connection, params);
  }

  // View operations
  async createView(params: viewOps.CreateViewParams): Promise<AxiosResponse> {
    return viewOps.createView(this.connection, params);
  }

  async updateViewSource(params: viewOps.UpdateViewSourceParams): Promise<AxiosResponse> {
    return viewOps.updateViewSource(this.connection, params);
  }

  // FunctionGroup operations
  async createFunctionGroup(params: functionGroupOps.CreateFunctionGroupParams): Promise<AxiosResponse> {
    return functionGroupOps.createFunctionGroup(this.connection, params);
  }

  // FunctionModule operations
  async createFunctionModule(params: functionModuleOps.CreateFunctionModuleParams): Promise<AxiosResponse> {
    return functionModuleOps.createFunctionModule(this.connection, params);
  }

  async updateFunctionModuleSource(params: functionModuleOps.UpdateFunctionModuleSourceParams): Promise<AxiosResponse> {
    return functionModuleOps.updateFunctionModuleSource(this.connection, params);
  }

  // Package operations
  async createPackage(params: packageOps.CreatePackageParams): Promise<AxiosResponse> {
    return packageOps.createPackage(this.connection, params);
  }

  // Transport operations
  async createTransport(params: transportOps.CreateTransportParams): Promise<AxiosResponse> {
    return transportOps.createTransport(this.connection, params);
  }

  // Delete operations (common for all object types)
  async deleteObject(params: deleteOps.DeleteObjectParams): Promise<AxiosResponse> {
    return deleteOps.deleteObject(this.connection, params);
  }
}

