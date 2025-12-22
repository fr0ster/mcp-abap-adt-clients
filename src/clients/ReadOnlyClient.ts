/**
 * ReadOnlyClient - Read-only operations for SAP ADT
 *
 * Exposes only read() methods from Builders.
 * All methods return raw AxiosResponse - no MCP formatting.
 */

import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { ClassBuilder, type IClassBuilderConfig } from '../core/class';
import {
  DataElementBuilder,
  type IDataElementConfig,
} from '../core/dataElement';
import { DomainBuilder, type IDomainConfig } from '../core/domain';
import {
  FunctionGroupBuilder,
  type IFunctionGroupConfig,
} from '../core/functionGroup';
import {
  FunctionModuleBuilder,
  type IFunctionModuleConfig,
} from '../core/functionModule';
import { type IInterfaceConfig, InterfaceBuilder } from '../core/interface';
import { type IPackageConfig, PackageBuilder } from '../core/package';
import { type IProgramConfig, ProgramBuilder } from '../core/program';
import {
  type IServiceDefinitionConfig,
  ServiceDefinitionBuilder,
} from '../core/serviceDefinition';
import { type IStructureConfig, StructureBuilder } from '../core/structure';
import { type ITableConfig, TableBuilder } from '../core/table';
import { TransportBuilder } from '../core/transport';
import { type IViewConfig, ViewBuilder } from '../core/view';

interface ReadOnlyClientState {
  readResult?: AxiosResponse;
  readBuilder?:
    | DomainBuilder
    | ClassBuilder
    | InterfaceBuilder
    | ProgramBuilder
    | DataElementBuilder
    | StructureBuilder
    | TableBuilder
    | ViewBuilder
    | FunctionGroupBuilder
    | FunctionModuleBuilder
    | PackageBuilder
    | ServiceDefinitionBuilder;
}

export class ReadOnlyClient {
  protected connection: IAbapConnection;
  protected logger: ILogger;
  private state: ReadOnlyClientState = {};

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    this.connection = connection;
  }

  // State getter (deprecated - use type-specific getters)
  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  // Type-specific getters that return config interfaces
  getDomainReadResult(): IDomainConfig | undefined {
    if (this.state.readBuilder instanceof DomainBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getClassReadResult(): IClassBuilderConfig | undefined {
    if (this.state.readBuilder instanceof ClassBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getInterfaceReadResult(): IInterfaceConfig | undefined {
    if (this.state.readBuilder instanceof InterfaceBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getProgramReadResult(): IProgramConfig | undefined {
    if (this.state.readBuilder instanceof ProgramBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getDataElementReadResult(): IDataElementConfig | undefined {
    if (this.state.readBuilder instanceof DataElementBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getStructureReadResult(): IStructureConfig | undefined {
    if (this.state.readBuilder instanceof StructureBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getTableReadResult(): ITableConfig | undefined {
    if (this.state.readBuilder instanceof TableBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getViewReadResult(): IViewConfig | undefined {
    if (this.state.readBuilder instanceof ViewBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getFunctionGroupReadResult(): IFunctionGroupConfig | undefined {
    if (this.state.readBuilder instanceof FunctionGroupBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getFunctionModuleReadResult(): IFunctionModuleConfig | undefined {
    if (this.state.readBuilder instanceof FunctionModuleBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getPackageReadResult(): IPackageConfig | undefined {
    if (this.state.readBuilder instanceof PackageBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  getServiceDefinitionReadResult(): IServiceDefinitionConfig | undefined {
    if (this.state.readBuilder instanceof ServiceDefinitionBuilder) {
      return this.state.readBuilder.getReadResult();
    }
    return undefined;
  }

  // Program operations
  async readProgram(programName: string): Promise<IProgramConfig | undefined> {
    const builder = new ProgramBuilder(
      this.connection,
      { programName, description: '' },
      this.logger,
    );
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
  async readClass(className: string): Promise<IClassBuilderConfig | undefined> {
    const builder = new ClassBuilder(
      this.connection,
      { className, description: '' },
      this.logger,
    );
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
  async readInterface(
    interfaceName: string,
  ): Promise<IInterfaceConfig | undefined> {
    const builder = new InterfaceBuilder(
      this.connection,
      { interfaceName, description: '' },
      this.logger,
    );
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
  async readDataElement(
    dataElementName: string,
  ): Promise<IDataElementConfig | undefined> {
    const builder = new DataElementBuilder(
      this.connection,
      { dataElementName, description: '' },
      this.logger,
    );
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
  async readDomain(domainName: string): Promise<IDomainConfig | undefined> {
    const builder = new DomainBuilder(
      this.connection,
      { domainName, description: '' },
      this.logger,
    );
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
  async readStructure(
    structureName: string,
  ): Promise<IStructureConfig | undefined> {
    const builder = new StructureBuilder(
      this.connection,
      { structureName, description: '' },
      this.logger,
    );
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
  async readTable(tableName: string): Promise<ITableConfig | undefined> {
    const builder = new TableBuilder(
      this.connection,
      { tableName },
      this.logger,
    );
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
  async readView(viewName: string): Promise<IViewConfig | undefined> {
    const builder = new ViewBuilder(
      this.connection,
      { viewName, description: '' },
      this.logger,
    );
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
  async readFunctionGroup(
    functionGroupName: string,
  ): Promise<IFunctionGroupConfig | undefined> {
    const builder = new FunctionGroupBuilder(
      this.connection,
      { functionGroupName, description: '' },
      this.logger,
    );
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
  async readFunctionModule(
    functionModuleName: string,
    functionGroupName: string,
  ): Promise<IFunctionModuleConfig | undefined> {
    const builder = new FunctionModuleBuilder(
      this.connection,
      { functionModuleName, functionGroupName, description: '' },
      this.logger,
    );
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
  async readPackage(packageName: string): Promise<IPackageConfig | undefined> {
    const builder = new PackageBuilder(
      this.connection,
      { packageName, description: '', superPackage: '' },
      this.logger,
    );
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
  async readServiceDefinition(
    serviceDefinitionName: string,
  ): Promise<IServiceDefinitionConfig | undefined> {
    // For read operations, description is not needed - only serviceDefinitionName is required
    const builder = new ServiceDefinitionBuilder(
      this.connection,
      { serviceDefinitionName },
      this.logger,
    );
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
    const builder = new TransportBuilder(
      this.connection,
      { description: '' },
      this.logger,
    );
    await builder.read(transportRequest);
    this.state.readResult = builder.getState().readResult;
    return this;
  }
}
