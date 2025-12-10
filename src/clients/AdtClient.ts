/**
 * AdtClient - High-level ADT Object Operations Client
 * 
 * Provides simplified CRUD operations with automatic operation chains,
 * error handling, and resource cleanup.
 * 
 * Unlike CrudClient which provides low-level operations, AdtClient provides
 * high-level methods that encapsulate complex operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 * 
 * Each factory method returns an IAdtObject instance that can be used
 * to perform operations on a specific object type.
 */

import { IAbapConnection, IAdtObject } from '@mcp-abap-adt/interfaces';
import { IAdtLogger, emptyLogger } from '../utils/logger';
import { 
  IClassConfig,
  IClassState,
  AdtClass,
  AdtLocalTestClass,
  AdtLocalTypes,
  AdtLocalDefinitions,
  AdtLocalMacros,
  ILocalTestClassConfig,
  ILocalTypesConfig,
  ILocalDefinitionsConfig,
  ILocalMacrosConfig
} from '../core/class';
import { IProgramConfig, IProgramState, AdtProgram } from '../core/program';
import { IInterfaceConfig, IInterfaceState, AdtInterface } from '../core/interface';
import { IDomainConfig, IDomainState, AdtDomain } from '../core/domain';
import { IDataElementConfig, IDataElementState, AdtDataElement } from '../core/dataElement';
import { IStructureConfig, IStructureState, AdtStructure } from '../core/structure';
import { ITableConfig, ITableState, AdtTable } from '../core/table';
import { IViewConfig, IViewState, AdtView } from '../core/view';
import { IFunctionGroupConfig, IFunctionGroupState, AdtFunctionGroup } from '../core/functionGroup';
import { IFunctionModuleConfig, IFunctionModuleState, AdtFunctionModule } from '../core/functionModule';
import { IPackageConfig, IPackageState, AdtPackage } from '../core/package';
import { IServiceDefinitionConfig, IServiceDefinitionState, AdtServiceDefinition } from '../core/serviceDefinition';
import { IBehaviorDefinitionConfig, IBehaviorDefinitionState, AdtBehaviorDefinition } from '../core/behaviorDefinition';
import { IBehaviorImplementationConfig, IBehaviorImplementationState, AdtBehaviorImplementation } from '../core/behaviorImplementation';
import { IMetadataExtensionConfig, IMetadataExtensionState, AdtMetadataExtension } from '../core/metadataExtension';
import { AdtRequest } from '../core/transport';
import { AdtUnitTest } from '../core/unitTest';
import { ITransportConfig, ITransportState } from '../core/transport/types';
import { IUnitTestConfig, IUnitTestState } from '../core/unitTest/types';

export class AdtClient {
  private connection: IAbapConnection;
  private logger: IAdtLogger;

  constructor(
    connection: IAbapConnection,
    logger?: IAdtLogger
  ) {
    this.connection = connection;
    this.logger = logger || emptyLogger;
  }

  /**
   * Get high-level operations for Class objects
   * @returns IAdtObject instance for Class operations
   */
  getClass(): IAdtObject<IClassConfig, IClassState> {
    return new AdtClass(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Program objects
   * @returns IAdtObject instance for Program operations
   */
  getProgram(): IAdtObject<IProgramConfig, IProgramState> {
    return new AdtProgram(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Interface objects
   * @returns IAdtObject instance for Interface operations
   */
  getInterface(): IAdtObject<IInterfaceConfig, IInterfaceState> {
    return new AdtInterface(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Domain objects
   * @returns IAdtObject instance for Domain operations
   */
  getDomain(): IAdtObject<IDomainConfig, IDomainState> {
    return new AdtDomain(this.connection, this.logger);
  }

  /**
   * Get high-level operations for DataElement objects
   * @returns IAdtObject instance for DataElement operations
   */
  getDataElement(): IAdtObject<IDataElementConfig, IDataElementState> {
    return new AdtDataElement(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Structure objects
   * @returns IAdtObject instance for Structure operations
   */
  getStructure(): IAdtObject<IStructureConfig, IStructureState> {
    return new AdtStructure(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Table objects
   * @returns IAdtObject instance for Table operations
   */
  getTable(): IAdtObject<ITableConfig, ITableState> {
    return new AdtTable(this.connection, this.logger);
  }

  /**
   * Get high-level operations for View objects
   * @returns IAdtObject instance for View operations
   */
  getView(): IAdtObject<IViewConfig, IViewState> {
    return new AdtView(this.connection, this.logger);
  }

  /**
   * Get high-level operations for FunctionGroup objects
   * @returns IAdtObject instance for FunctionGroup operations
   */
  getFunctionGroup(): IAdtObject<IFunctionGroupConfig, IFunctionGroupState> {
    return new AdtFunctionGroup(this.connection, this.logger);
  }

  /**
   * Get high-level operations for FunctionModule objects
   * @returns IAdtObject instance for FunctionModule operations
   */
  getFunctionModule(): IAdtObject<IFunctionModuleConfig, IFunctionModuleState> {
    return new AdtFunctionModule(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Package objects
   * @returns IAdtObject instance for Package operations
   */
  getPackage(): IAdtObject<IPackageConfig, IPackageState> {
    return new AdtPackage(this.connection, this.logger);
  }

  /**
   * Get high-level operations for ServiceDefinition objects
   * @returns IAdtObject instance for ServiceDefinition operations
   */
  getServiceDefinition(): IAdtObject<IServiceDefinitionConfig, IServiceDefinitionState> {
    return new AdtServiceDefinition(this.connection, this.logger);
  }

  /**
   * Get high-level operations for BehaviorDefinition objects
   * @returns IAdtObject instance for BehaviorDefinition operations
   */
  getBehaviorDefinition(): IAdtObject<IBehaviorDefinitionConfig, IBehaviorDefinitionState> {
    return new AdtBehaviorDefinition(this.connection, this.logger);
  }

  /**
   * Get high-level operations for BehaviorImplementation objects
   * @returns IAdtObject instance for BehaviorImplementation operations
   */
  getBehaviorImplementation(): IAdtObject<IBehaviorImplementationConfig, IBehaviorImplementationState> {
    return new AdtBehaviorImplementation(this.connection, this.logger);
  }

  /**
   * Get high-level operations for MetadataExtension objects
   * @returns IAdtObject instance for MetadataExtension operations
   */
  getMetadataExtension(): IAdtObject<IMetadataExtensionConfig, IMetadataExtensionState> {
    return new AdtMetadataExtension(this.connection, this.logger);
  }

  /**
   * Get high-level operations for UnitTest objects
   * @returns IAdtObject instance for UnitTest operations
   */
  getUnitTest(): IAdtObject<IUnitTestConfig, IUnitTestState> {
    return new AdtUnitTest(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Request (Transport Request) objects
   * @returns IAdtObject instance for Request operations
   */
  getRequest(): IAdtObject<ITransportConfig, ITransportState> {
    return new AdtRequest(this.connection, this.logger);
  }


  /**
   * Get high-level operations for LocalTestClass objects
   * @returns IAdtObject instance for LocalTestClass operations
   */
  getLocalTestClass(): IAdtObject<ILocalTestClassConfig, IClassState> {
    return new AdtLocalTestClass(this.connection, this.logger);
  }

  /**
   * Get high-level operations for LocalTypes objects
   * @returns IAdtObject instance for LocalTypes operations
   */
  getLocalTypes(): IAdtObject<ILocalTypesConfig, IClassState> {
    return new AdtLocalTypes(this.connection, this.logger);
  }

  /**
   * Get high-level operations for LocalDefinitions objects
   * @returns IAdtObject instance for LocalDefinitions operations
   */
  getLocalDefinitions(): IAdtObject<ILocalDefinitionsConfig, IClassState> {
    return new AdtLocalDefinitions(this.connection, this.logger);
  }

  /**
   * Get high-level operations for LocalMacros objects
   * @returns IAdtObject instance for LocalMacros operations
   */
  getLocalMacros(): IAdtObject<ILocalMacrosConfig, IClassState> {
    return new AdtLocalMacros(this.connection, this.logger);
  }
}
