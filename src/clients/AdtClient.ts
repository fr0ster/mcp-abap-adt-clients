/**
 * AdtClient - High-level ADT Object Operations Client
 *
 * Provides simplified CRUD operations with automatic operation chains,
 * error handling, and resource cleanup.
 *
 * AdtClient provides high-level methods that encapsulate complex operation chains:
 * - Create: validate → create → check → lock → check(inactive) → update → unlock → check → activate
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 *
 * Each factory method returns an IAdtObject instance that can be used
 * to perform operations on a specific object type.
 */

import type {
  IAbapConnection,
  IAdtObject,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  AdtBehaviorDefinition,
  type IBehaviorDefinitionConfig,
  type IBehaviorDefinitionState,
} from '../core/behaviorDefinition';
import {
  AdtBehaviorImplementation,
  type IBehaviorImplementationConfig,
  type IBehaviorImplementationState,
} from '../core/behaviorImplementation';
import {
  AdtClass,
  AdtLocalDefinitions,
  AdtLocalMacros,
  AdtLocalTestClass,
  AdtLocalTypes,
  type IClassConfig,
  type IClassState,
  type ILocalDefinitionsConfig,
  type ILocalMacrosConfig,
  type ILocalTestClassConfig,
  type ILocalTypesConfig,
} from '../core/class';
import {
  AdtDataElement,
  type IDataElementConfig,
  type IDataElementState,
} from '../core/dataElement';
import {
  AdtDomain,
  type IDomainConfig,
  type IDomainState,
} from '../core/domain';
import {
  AdtEnhancement,
  type IEnhancementConfig,
  type IEnhancementState,
} from '../core/enhancement';
import {
  AdtFunctionGroup,
  type IFunctionGroupConfig,
  type IFunctionGroupState,
} from '../core/functionGroup';
import {
  AdtFunctionModule,
  type IFunctionModuleConfig,
  type IFunctionModuleState,
} from '../core/functionModule';
import {
  AdtInterface,
  type IInterfaceConfig,
  type IInterfaceState,
} from '../core/interface';
import {
  AdtMetadataExtension,
  type IMetadataExtensionConfig,
  type IMetadataExtensionState,
} from '../core/metadataExtension';
import {
  AdtPackage,
  type IPackageConfig,
  type IPackageState,
} from '../core/package';
import {
  AdtProgram,
  type IProgramConfig,
  type IProgramState,
} from '../core/program';
import {
  AdtServiceDefinition,
  type IServiceDefinitionConfig,
  type IServiceDefinitionState,
} from '../core/serviceDefinition';
import { AdtUtils } from '../core/shared/AdtUtils';
import {
  AdtStructure,
  type IStructureConfig,
  type IStructureState,
} from '../core/structure';
import { AdtTable, type ITableConfig, type ITableState } from '../core/table';
import {
  AdtDdicTableType,
  type ITableTypeConfig,
  type ITableTypeState,
} from '../core/tabletype';
import { AdtRequest } from '../core/transport';
import type {
  ITransportConfig,
  ITransportState,
} from '../core/transport/types';
import {
  AdtCdsUnitTest,
  AdtUnitTest,
  type ICdsUnitTestConfig,
  type ICdsUnitTestState,
  type IUnitTestConfig,
  type IUnitTestState,
} from '../core/unitTest';
import { AdtView, type IViewConfig, type IViewState } from '../core/view';

export class AdtClient {
  private connection: IAbapConnection;
  private logger: ILogger;

  constructor(connection: IAbapConnection, logger?: ILogger) {
    this.connection = connection;
    this.logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
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
   * Get high-level operations for TableType (DDIC Table Type) objects
   * @returns IAdtObject instance for TableType operations
   */
  getTableType(): IAdtObject<ITableTypeConfig, ITableTypeState> {
    return new AdtDdicTableType(this.connection, this.logger);
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
  getServiceDefinition(): IAdtObject<
    IServiceDefinitionConfig,
    IServiceDefinitionState
  > {
    return new AdtServiceDefinition(this.connection, this.logger);
  }

  /**
   * Get high-level operations for BehaviorDefinition objects
   * @returns IAdtObject instance for BehaviorDefinition operations
   */
  getBehaviorDefinition(): IAdtObject<
    IBehaviorDefinitionConfig,
    IBehaviorDefinitionState
  > {
    return new AdtBehaviorDefinition(this.connection, this.logger);
  }

  /**
   * Get high-level operations for BehaviorImplementation objects
   * @returns IAdtObject instance for BehaviorImplementation operations
   */
  getBehaviorImplementation(): IAdtObject<
    IBehaviorImplementationConfig,
    IBehaviorImplementationState
  > {
    return new AdtBehaviorImplementation(this.connection, this.logger);
  }

  /**
   * Get high-level operations for MetadataExtension objects
   * @returns IAdtObject instance for MetadataExtension operations
   */
  getMetadataExtension(): IAdtObject<
    IMetadataExtensionConfig,
    IMetadataExtensionState
  > {
    return new AdtMetadataExtension(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Enhancement objects
   * Supports multiple enhancement types:
   * - Enhancement Implementation (ENHO)
   * - BAdI Implementation
   * - Source Code Plugin (with source code)
   * - Enhancement Spot (ENHS)
   * - BAdI Enhancement Spot
   * @returns IAdtObject instance for Enhancement operations
   */
  getEnhancement(): IAdtObject<IEnhancementConfig, IEnhancementState> {
    return new AdtEnhancement(this.connection, this.logger);
  }

  /**
   * Get high-level operations for UnitTest objects
   * @returns IAdtObject instance for UnitTest operations
   */
  getUnitTest(): IAdtObject<IUnitTestConfig, IUnitTestState> {
    return new AdtUnitTest(this.connection, this.logger);
  }

  /**
   * Get high-level operations for CDS UnitTest objects
   * @returns IAdtObject instance for CDS UnitTest operations (extends AdtUnitTest with CDS-specific methods)
   */
  getCdsUnitTest(): IAdtObject<ICdsUnitTestConfig, ICdsUnitTestState> {
    return new AdtCdsUnitTest(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Request (Transport Request) objects
   * @returns IAdtObject instance for Request operations
   */
  getRequest(): IAdtObject<ITransportConfig, ITransportState> {
    return new AdtRequest(this.connection, this.logger);
  }

  /**
   * Get utility functions (NOT CRUD operations)
   * Provides access to cross-cutting ADT utility functions:
   * - Search operations
   * - Where-used analysis
   * - Inactive objects management
   * - Group activation/deletion
   * - Object metadata and source code reading
   * - SQL queries and table contents
   *
   * @returns AdtUtils instance for utility operations
   */
  getUtils(): AdtUtils {
    return new AdtUtils(this.connection, this.logger);
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
