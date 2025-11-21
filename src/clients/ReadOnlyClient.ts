/**
 * ReadOnlyClient - Read-only operations for SAP ADT
 *
 * Exposes only read() methods from Builders.
 * All methods return raw AxiosResponse - no MCP formatting.
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { ProgramBuilder } from '../core/program';
import { ClassBuilder } from '../core/class';
import { InterfaceBuilder } from '../core/interface';
import { DataElementBuilder } from '../core/dataElement';
import { DomainBuilder } from '../core/domain';
import { StructureBuilder } from '../core/structure';
import { TableBuilder } from '../core/table';
import { ViewBuilder } from '../core/view';
import { FunctionGroupBuilder } from '../core/functionGroup';
import { FunctionModuleBuilder } from '../core/functionModule';
import { PackageBuilder } from '../core/package';
import { TransportBuilder } from '../core/transport';

export class ReadOnlyClient {
  protected connection: AbapConnection;

  constructor(connection: AbapConnection) {
    this.connection = connection;
  }

  // Program operations
  async readProgram(programName: string): Promise<AxiosResponse> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // Class operations
  async readClass(className: string): Promise<AxiosResponse> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // Interface operations
  async readInterface(interfaceName: string): Promise<AxiosResponse> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // DataElement operations
  async readDataElement(dataElementName: string): Promise<AxiosResponse> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // Domain operations
  async readDomain(domainName: string): Promise<AxiosResponse> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // Structure operations
  async readStructure(structureName: string): Promise<AxiosResponse> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // Table operations
  async readTable(tableName: string): Promise<AxiosResponse> {
    const builder = new TableBuilder(this.connection, {}, { tableName });
    await builder.read();
    return builder.getState().readResult!;
  }

  // View operations
  async readView(viewName: string): Promise<AxiosResponse> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // FunctionGroup operations
  async readFunctionGroup(functionGroupName: string): Promise<AxiosResponse> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // FunctionModule operations
  async readFunctionModule(functionModuleName: string, functionGroupName: string): Promise<AxiosResponse> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // Package operations
  async readPackage(packageName: string): Promise<AxiosResponse> {
    const builder = new PackageBuilder(this.connection, {}, { packageName, description: '', superPackage: '' });
    await builder.read();
    return builder.getState().readResult!;
  }

  // Transport operations
  async readTransport(transportRequest: string): Promise<AxiosResponse> {
    const builder = new TransportBuilder(this.connection, {}, { description: '' });
    await builder.read(transportRequest);
    return builder.getState().readResult!;
  }
}
