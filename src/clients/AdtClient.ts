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
import { DataElementBuilderConfig } from '../core/dataElement';
import { StructureBuilderConfig } from '../core/structure';
import { TableBuilderConfig } from '../core/table';
import { ViewBuilderConfig } from '../core/view';
import { FunctionGroupBuilderConfig } from '../core/functionGroup';
import { FunctionModuleBuilderConfig } from '../core/functionModule';
import { PackageBuilderConfig } from '../core/package';
import { ServiceDefinitionBuilderConfig } from '../core/serviceDefinition';
import { BehaviorDefinitionBuilderConfig } from '../core/behaviorDefinition';
import { BehaviorImplementationBuilderConfig } from '../core/behaviorImplementation';
import { MetadataExtensionBuilderConfig } from '../core/metadataExtension';

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
    // TODO: Implement AdtDataElement
    throw new Error('AdtDataElement not yet implemented');
  }

  /**
   * Get high-level operations for Structure objects
   * @returns IAdtObject instance for Structure operations
   */
  getStructure(): IAdtObject<StructureBuilderConfig, StructureBuilderConfig> {
    // TODO: Implement AdtStructure
    throw new Error('AdtStructure not yet implemented');
  }

  /**
   * Get high-level operations for Table objects
   * @returns IAdtObject instance for Table operations
   */
  getTable(): IAdtObject<TableBuilderConfig, TableBuilderConfig> {
    // TODO: Implement AdtTable
    throw new Error('AdtTable not yet implemented');
  }

  /**
   * Get high-level operations for View objects
   * @returns IAdtObject instance for View operations
   */
  getView(): IAdtObject<ViewBuilderConfig, ViewBuilderConfig> {
    // TODO: Implement AdtView
    throw new Error('AdtView not yet implemented');
  }

  /**
   * Get high-level operations for FunctionGroup objects
   * @returns IAdtObject instance for FunctionGroup operations
   */
  getFunctionGroup(): IAdtObject<FunctionGroupBuilderConfig, FunctionGroupBuilderConfig> {
    // TODO: Implement AdtFunctionGroup
    throw new Error('AdtFunctionGroup not yet implemented');
  }

  /**
   * Get high-level operations for FunctionModule objects
   * @returns IAdtObject instance for FunctionModule operations
   */
  getFunctionModule(): IAdtObject<FunctionModuleBuilderConfig, FunctionModuleBuilderConfig> {
    // TODO: Implement AdtFunctionModule
    throw new Error('AdtFunctionModule not yet implemented');
  }

  /**
   * Get high-level operations for Package objects
   * @returns IAdtObject instance for Package operations
   */
  getPackage(): IAdtObject<PackageBuilderConfig, PackageBuilderConfig> {
    // TODO: Implement AdtPackage
    throw new Error('AdtPackage not yet implemented');
  }

  /**
   * Get high-level operations for ServiceDefinition objects
   * @returns IAdtObject instance for ServiceDefinition operations
   */
  getServiceDefinition(): IAdtObject<ServiceDefinitionBuilderConfig, ServiceDefinitionBuilderConfig> {
    // TODO: Implement AdtServiceDefinition
    throw new Error('AdtServiceDefinition not yet implemented');
  }

  /**
   * Get high-level operations for BehaviorDefinition objects
   * @returns IAdtObject instance for BehaviorDefinition operations
   */
  getBehaviorDefinition(): IAdtObject<BehaviorDefinitionBuilderConfig, BehaviorDefinitionBuilderConfig> {
    // TODO: Implement AdtBehaviorDefinition
    throw new Error('AdtBehaviorDefinition not yet implemented');
  }

  /**
   * Get high-level operations for BehaviorImplementation objects
   * @returns IAdtObject instance for BehaviorImplementation operations
   */
  getBehaviorImplementation(): IAdtObject<BehaviorImplementationBuilderConfig, BehaviorImplementationBuilderConfig> {
    // TODO: Implement AdtBehaviorImplementation
    throw new Error('AdtBehaviorImplementation not yet implemented');
  }

  /**
   * Get high-level operations for MetadataExtension objects
   * @returns IAdtObject instance for MetadataExtension operations
   */
  getMetadataExtension(): IAdtObject<MetadataExtensionBuilderConfig, MetadataExtensionBuilderConfig> {
    // TODO: Implement AdtMetadataExtension
    throw new Error('AdtMetadataExtension not yet implemented');
  }
}
