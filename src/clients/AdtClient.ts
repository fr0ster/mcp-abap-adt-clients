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
import { ClassBuilderConfig, AdtClass } from '../core/class';
import { ProgramBuilderConfig, AdtProgram } from '../core/program';
import { InterfaceBuilderConfig, AdtInterface } from '../core/interface';
import { DomainBuilderConfig, AdtDomain } from '../core/domain';
import { DataElementBuilderConfig, AdtDataElement } from '../core/dataElement';
import { StructureBuilderConfig, AdtStructure } from '../core/structure';
import { TableBuilderConfig, AdtTable } from '../core/table';
import { ViewBuilderConfig, AdtView } from '../core/view';
import { FunctionGroupBuilderConfig, AdtFunctionGroup } from '../core/functionGroup';
import { FunctionModuleBuilderConfig, AdtFunctionModule } from '../core/functionModule';
import { PackageBuilderConfig, AdtPackage } from '../core/package';
import { ServiceDefinitionBuilderConfig, AdtServiceDefinition } from '../core/serviceDefinition';
import { BehaviorDefinitionBuilderConfig, AdtBehaviorDefinition } from '../core/behaviorDefinition';
import { BehaviorImplementationBuilderConfig, AdtBehaviorImplementation } from '../core/behaviorImplementation';
import { MetadataExtensionBuilderConfig, AdtMetadataExtension } from '../core/metadataExtension';
import { AdtRequest } from '../core/transport';
import { AdtUnitTest } from '../core/unitTest';
import { ITransportBuilderConfig, IUnitTestBuilderConfig } from '@mcp-abap-adt/interfaces';

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
  getClass(): IAdtObject<ClassBuilderConfig, ClassBuilderConfig> {
    return new AdtClass(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Program objects
   * @returns IAdtObject instance for Program operations
   */
  getProgram(): IAdtObject<ProgramBuilderConfig, ProgramBuilderConfig> {
    return new AdtProgram(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Interface objects
   * @returns IAdtObject instance for Interface operations
   */
  getInterface(): IAdtObject<InterfaceBuilderConfig, InterfaceBuilderConfig> {
    return new AdtInterface(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Domain objects
   * @returns IAdtObject instance for Domain operations
   */
  getDomain(): IAdtObject<DomainBuilderConfig, DomainBuilderConfig> {
    return new AdtDomain(this.connection, this.logger);
  }

  /**
   * Get high-level operations for DataElement objects
   * @returns IAdtObject instance for DataElement operations
   */
  getDataElement(): IAdtObject<DataElementBuilderConfig, DataElementBuilderConfig> {
    return new AdtDataElement(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Structure objects
   * @returns IAdtObject instance for Structure operations
   */
  getStructure(): IAdtObject<StructureBuilderConfig, StructureBuilderConfig> {
    return new AdtStructure(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Table objects
   * @returns IAdtObject instance for Table operations
   */
  getTable(): IAdtObject<TableBuilderConfig, TableBuilderConfig> {
    return new AdtTable(this.connection, this.logger);
  }

  /**
   * Get high-level operations for View objects
   * @returns IAdtObject instance for View operations
   */
  getView(): IAdtObject<ViewBuilderConfig, ViewBuilderConfig> {
    return new AdtView(this.connection, this.logger);
  }

  /**
   * Get high-level operations for FunctionGroup objects
   * @returns IAdtObject instance for FunctionGroup operations
   */
  getFunctionGroup(): IAdtObject<FunctionGroupBuilderConfig, FunctionGroupBuilderConfig> {
    return new AdtFunctionGroup(this.connection, this.logger);
  }

  /**
   * Get high-level operations for FunctionModule objects
   * @returns IAdtObject instance for FunctionModule operations
   */
  getFunctionModule(): IAdtObject<FunctionModuleBuilderConfig, FunctionModuleBuilderConfig> {
    return new AdtFunctionModule(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Package objects
   * @returns IAdtObject instance for Package operations
   */
  getPackage(): IAdtObject<PackageBuilderConfig, PackageBuilderConfig> {
    return new AdtPackage(this.connection, this.logger);
  }

  /**
   * Get high-level operations for ServiceDefinition objects
   * @returns IAdtObject instance for ServiceDefinition operations
   */
  getServiceDefinition(): IAdtObject<ServiceDefinitionBuilderConfig, ServiceDefinitionBuilderConfig> {
    return new AdtServiceDefinition(this.connection, this.logger);
  }

  /**
   * Get high-level operations for BehaviorDefinition objects
   * @returns IAdtObject instance for BehaviorDefinition operations
   */
  getBehaviorDefinition(): IAdtObject<BehaviorDefinitionBuilderConfig, BehaviorDefinitionBuilderConfig> {
    return new AdtBehaviorDefinition(this.connection, this.logger);
  }

  /**
   * Get high-level operations for BehaviorImplementation objects
   * @returns IAdtObject instance for BehaviorImplementation operations
   */
  getBehaviorImplementation(): IAdtObject<BehaviorImplementationBuilderConfig, BehaviorImplementationBuilderConfig> {
    return new AdtBehaviorImplementation(this.connection, this.logger);
  }

  /**
   * Get high-level operations for MetadataExtension objects
   * @returns IAdtObject instance for MetadataExtension operations
   */
  getMetadataExtension(): IAdtObject<MetadataExtensionBuilderConfig, MetadataExtensionBuilderConfig> {
    return new AdtMetadataExtension(this.connection, this.logger);
  }

  /**
   * Get high-level operations for UnitTest objects
   * @returns IAdtObject instance for UnitTest operations
   */
  getUnitTest(): IAdtObject<IUnitTestBuilderConfig, IUnitTestBuilderConfig> {
    return new AdtUnitTest(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Request (Transport Request) objects
   * @returns IAdtObject instance for Request operations
   */
  getRequest(): IAdtObject<ITransportBuilderConfig, ITransportBuilderConfig> {
    return new AdtRequest(this.connection, this.logger);
  }
}
