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

interface ReadOnlyClientState {
  readResult?: AxiosResponse;
}

export class ReadOnlyClient {
  protected connection: AbapConnection;
  private state: ReadOnlyClientState = {};

  constructor(connection: AbapConnection) {
    this.connection = connection;
  }

  // State getter
  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  // Program operations
  async readProgram(programName: string): Promise<this> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // Class operations
  async readClass(className: string): Promise<this> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // Interface operations
  async readInterface(interfaceName: string): Promise<this> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // DataElement operations
  async readDataElement(dataElementName: string): Promise<this> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // Domain operations
  async readDomain(domainName: string): Promise<this> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // Structure operations
  async readStructure(structureName: string): Promise<this> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // Table operations
  async readTable(tableName: string): Promise<this> {
    const builder = new TableBuilder(this.connection, {}, { tableName });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // View operations
  async readView(viewName: string): Promise<this> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // FunctionGroup operations
  async readFunctionGroup(functionGroupName: string): Promise<this> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // FunctionModule operations
  async readFunctionModule(functionModuleName: string, functionGroupName: string): Promise<this> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // Package operations
  async readPackage(packageName: string): Promise<this> {
    const builder = new PackageBuilder(this.connection, {}, { packageName, description: '', superPackage: '' });
    await builder.read();
    this.state.readResult = builder.getState().readResult;
    return this;
  }

  // Transport operations
  async readTransport(transportRequest: string): Promise<this> {
    const builder = new TransportBuilder(this.connection, {}, { description: '' });
    await builder.read(transportRequest);
    this.state.readResult = builder.getState().readResult;
    return this;
  }
}
