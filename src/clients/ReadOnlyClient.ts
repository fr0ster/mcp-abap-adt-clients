/**
 * ReadOnlyClient - Read-only operations for SAP ADT
 *
 * Exposes only read() methods from Builders.
 * All methods return raw AxiosResponse - no MCP formatting.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { ProgramBuilder, ProgramBuilderConfig } from '../core/program';
import { ClassBuilder, ClassBuilderConfig } from '../core/class';
import { InterfaceBuilder, InterfaceBuilderConfig } from '../core/interface';
import { DataElementBuilder, DataElementBuilderConfig } from '../core/dataElement';
import { DomainBuilder, DomainBuilderConfig } from '../core/domain';
import { StructureBuilder, StructureBuilderConfig } from '../core/structure';
import { TableBuilder, TableBuilderConfig } from '../core/table';
import { ViewBuilder, ViewBuilderConfig } from '../core/view';
import { FunctionGroupBuilder, FunctionGroupBuilderConfig } from '../core/functionGroup';
import { FunctionModuleBuilder, FunctionModuleBuilderConfig } from '../core/functionModule';
import { PackageBuilder, PackageBuilderConfig } from '../core/package';
import { TransportBuilder } from '../core/transport';
import { ServiceDefinitionBuilder, ServiceDefinitionBuilderConfig } from '../core/serviceDefinition';

interface ReadOnlyClientState {
  readResult?: AxiosResponse;
  readBuilder?: DomainBuilder | ClassBuilder | InterfaceBuilder | ProgramBuilder | DataElementBuilder | StructureBuilder | TableBuilder | ViewBuilder | FunctionGroupBuilder | FunctionModuleBuilder | PackageBuilder | ServiceDefinitionBuilder;
}

export class ReadOnlyClient {
  protected connection: IAbapConnection;
  private state: ReadOnlyClientState = {};

  constructor(connection: IAbapConnection) {
    this.connection = connection;
  }

  // State getter (deprecated - use type-specific getters)
  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  // Type-specific getters that return config interfaces
  getDomainReadResult(): DomainBuilderConfig | undefined {
    if (this.state.readBuilder instanceof DomainBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getClassReadResult(): ClassBuilderConfig | undefined {
    if (this.state.readBuilder instanceof ClassBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getInterfaceReadResult(): InterfaceBuilderConfig | undefined {
    if (this.state.readBuilder instanceof InterfaceBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getProgramReadResult(): ProgramBuilderConfig | undefined {
    if (this.state.readBuilder instanceof ProgramBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getDataElementReadResult(): DataElementBuilderConfig | undefined {
    if (this.state.readBuilder instanceof DataElementBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getStructureReadResult(): StructureBuilderConfig | undefined {
    if (this.state.readBuilder instanceof StructureBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getTableReadResult(): TableBuilderConfig | undefined {
    if (this.state.readBuilder instanceof TableBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getViewReadResult(): ViewBuilderConfig | undefined {
    if (this.state.readBuilder instanceof ViewBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getFunctionGroupReadResult(): FunctionGroupBuilderConfig | undefined {
    if (this.state.readBuilder instanceof FunctionGroupBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getFunctionModuleReadResult(): FunctionModuleBuilderConfig | undefined {
    if (this.state.readBuilder instanceof FunctionModuleBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getPackageReadResult(): PackageBuilderConfig | undefined {
    if (this.state.readBuilder instanceof PackageBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getServiceDefinitionReadResult(): ServiceDefinitionBuilderConfig | undefined {
    if (this.state.readBuilder instanceof ServiceDefinitionBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  // Program operations
  async readProgram(programName: string): Promise<ProgramBuilderConfig | undefined> {
    const builder = new ProgramBuilder(this.connection, {}, { programName, description: '' });
    const result = await builder.read();
    // Store builder for getProgramReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // Class operations
  async readClass(className: string): Promise<ClassBuilderConfig | undefined> {
    const builder = new ClassBuilder(this.connection, {}, { className, description: '' });
    const result = await builder.read();
    // Store builder for getClassReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // Interface operations
  async readInterface(interfaceName: string): Promise<InterfaceBuilderConfig | undefined> {
    const builder = new InterfaceBuilder(this.connection, {}, { interfaceName, description: '' });
    const result = await builder.read();
    // Store builder for getInterfaceReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // DataElement operations
  async readDataElement(dataElementName: string): Promise<DataElementBuilderConfig | undefined> {
    const builder = new DataElementBuilder(this.connection, {}, { dataElementName, description: '' });
    const result = await builder.read();
    // Store builder for getDataElementReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // Domain operations
  async readDomain(domainName: string): Promise<DomainBuilderConfig | undefined> {
    const builder = new DomainBuilder(this.connection, {}, { domainName, description: '' });
    const result = await builder.read();
    // Store builder for getDomainReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // Structure operations
  async readStructure(structureName: string): Promise<StructureBuilderConfig | undefined> {
    const builder = new StructureBuilder(this.connection, {}, { structureName, description: '' });
    const result = await builder.read();
    // Store builder for getStructureReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // Table operations
  async readTable(tableName: string): Promise<TableBuilderConfig | undefined> {
    const builder = new TableBuilder(this.connection, {}, { tableName });
    const result = await builder.read();
    // Store builder for getTableReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // View operations
  async readView(viewName: string): Promise<ViewBuilderConfig | undefined> {
    const builder = new ViewBuilder(this.connection, {}, { viewName, description: '' });
    const result = await builder.read();
    // Store builder for getViewReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // FunctionGroup operations
  async readFunctionGroup(functionGroupName: string): Promise<FunctionGroupBuilderConfig | undefined> {
    const builder = new FunctionGroupBuilder(this.connection, {}, { functionGroupName, description: '' });
    const result = await builder.read();
    // Store builder for getFunctionGroupReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // FunctionModule operations
  async readFunctionModule(functionModuleName: string, functionGroupName: string): Promise<FunctionModuleBuilderConfig | undefined> {
    const builder = new FunctionModuleBuilder(this.connection, {}, { functionModuleName, functionGroupName, description: '' });
    const result = await builder.read();
    // Store builder for getFunctionModuleReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // Package operations
  async readPackage(packageName: string): Promise<PackageBuilderConfig | undefined> {
    const builder = new PackageBuilder(this.connection, {}, { packageName, description: '', superPackage: '' });
    const result = await builder.read();
    // Store builder for getPackageReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // ServiceDefinition operations
  async readServiceDefinition(serviceDefinitionName: string): Promise<ServiceDefinitionBuilderConfig | undefined> {
    // For read operations, description is not needed - only serviceDefinitionName is required
    const builder = new ServiceDefinitionBuilder(this.connection, {}, { serviceDefinitionName });
    const result = await builder.read();
    // Store builder for getServiceDefinitionReadResult()
    this.state.readBuilder = builder;
    // Store raw response for backward compatibility
    if (builder.getState().readResult) {
    this.state.readResult = builder.getState().readResult;
    }
    return result;
  }

  // Transport operations
  async readTransport(transportRequest: string): Promise<this> {
    const builder = new TransportBuilder(this.connection, {}, { description: '' });
    await builder.read(transportRequest);
    this.state.readResult = builder.getState().readResult;
    return this;
  }
}
