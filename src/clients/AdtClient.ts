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
  IAdtActivatable,
  IAdtCheckable,
  IAdtCrud,
  IAdtLockable,
  IAdtNonVersionedObject,
  IAdtObject,
  IAdtSourceObject,
  IAdtTransportAware,
  IAdtValidatable,
  IAdtVersionable,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  AdtAccessControl,
  type IAccessControlConfig,
  type IAccessControlState,
} from '../core/accessControl';
import {
  AdtAppendStructure,
  type IAppendStructureConfig,
  type IAppendStructureState,
} from '../core/appendStructure';
import { AdtAtc } from '../core/atc';
import {
  AdtAuthorizationField,
  type IAuthorizationFieldConfig,
  type IAuthorizationFieldState,
} from '../core/authorizationField';
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
import { AdtDdl, type IDdlConfig, type IDdlState } from '../core/ddl';
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
  AdtFeatureToggle,
  type IFeatureToggleObject,
} from '../core/featureToggle';
import {
  AdtFunctionGroup,
  type IFunctionGroupConfig,
  type IFunctionGroupState,
} from '../core/functionGroup';
import {
  AdtFunctionInclude,
  type IFunctionIncludeConfig,
  type IFunctionIncludeState,
} from '../core/functionInclude';
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
  AdtMessageClass,
  AdtMessageClassMessage,
  type IMessageClassConfig,
  type IMessageClassMessageConfig,
  type IMessageClassMessageState,
  type IMessageClassState,
} from '../core/messageClass';
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
  AdtScalarFunction,
  type IScalarFunctionConfig,
  type IScalarFunctionState,
} from '../core/scalarFunction';
import {
  AdtScalarFunctionImplementation,
  type IScalarFunctionImplementationConfig,
  type IScalarFunctionImplementationState,
} from '../core/scalarFunctionImplementation';
import { AdtServiceBinding, type IAdtServiceBinding } from '../core/service';
import {
  AdtServiceDefinition,
  type IServiceDefinitionConfig,
  type IServiceDefinitionState,
} from '../core/serviceDefinition';
import { AdtUtils } from '../core/shared/AdtUtils';
import { type LockFailure, LockRegistry } from '../core/shared/LockRegistry';
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
import {
  AdtTransformation,
  type ITransformationConfig,
  type ITransformationState,
} from '../core/transformation';
import { AdtRequest } from '../core/transport';
import {
  AdtCdsUnitTest,
  AdtUnitTest,
  type ICdsUnitTestConfig,
  type ICdsUnitTestState,
  type IUnitTestConfig,
  type IUnitTestState,
} from '../core/unitTest';

export interface IAdtSystemContext {
  masterSystem?: string;
  responsible?: string;
  /** Master/original language for newly created objects (adtcore:masterLanguage). Sourced from SAP_LANGUAGE; defaults to EN when unset. */
  masterLanguage?: string;
}

export interface IAdtClientOptions {
  enableAcceptCorrection?: boolean;
  masterSystem?: string;
  responsible?: string;
  /** Master/original language for newly created objects. Falls back to EN when unset. */
  masterLanguage?: string;
  contentTypes?: import('../core/shared/contentTypes').IAdtContentTypes;
  /** Whether the SAP system uses Unicode encoding. Affects Content-Type headers for source code operations. */
  unicode?: boolean;
}

export class AdtClient {
  protected connection: IAbapConnection;
  protected logger: ILogger;
  protected systemContext: IAdtSystemContext;
  protected contentTypes?: import('../core/shared/contentTypes').IAdtContentTypes;
  /**
   * Session-scoped registry of locks held by handlers created from this client.
   * All handlers share one stateful session, so all their locks belong here.
   */
  protected readonly lockRegistry: LockRegistry;

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    options?: IAdtClientOptions,
  ) {
    this.connection = connection;
    // Pass the connection so unlockAll() can keep the whole batch stateful.
    this.lockRegistry = new LockRegistry(connection);
    this.logger = logger ?? {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
    this.systemContext = {
      masterSystem: options?.masterSystem,
      responsible: options?.responsible,
      masterLanguage: options?.masterLanguage,
    };
    this.contentTypes = options?.contentTypes;
    if (options?.enableAcceptCorrection !== undefined) {
      const {
        setAcceptCorrectionEnabled,
        wrapConnectionAcceptNegotiation,
        getAcceptCorrectionEnabled,
      } = require('../utils/acceptNegotiation');
      setAcceptCorrectionEnabled(options.enableAcceptCorrection);
      const shouldWrap =
        options.enableAcceptCorrection ?? getAcceptCorrectionEnabled();
      if (shouldWrap) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    } else {
      const {
        getAcceptCorrectionEnabled,
        wrapConnectionAcceptNegotiation,
      } = require('../utils/acceptNegotiation');
      if (getAcceptCorrectionEnabled()) {
        wrapConnectionAcceptNegotiation(this.connection, this.logger);
      }
    }
  }

  /**
   * Get high-level operations for Class objects
   * @returns IAdtObject instance for Class operations
   */
  getClass(): IAdtSourceObject<IClassConfig, IClassState> {
    return new AdtClass(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for Program objects
   * @returns IAdtObject instance for Program operations
   */
  getProgram(): IAdtSourceObject<IProgramConfig, IProgramState> {
    return new AdtProgram(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for Interface objects
   * @returns IAdtObject instance for Interface operations
   */
  getInterface(): IAdtSourceObject<IInterfaceConfig, IInterfaceState> {
    return new AdtInterface(
      this.connection,
      this.logger,
      this.systemContext,
      undefined,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for Domain objects
   * @returns IAdtObject instance for Domain operations
   */
  getDomain(): IAdtNonVersionedObject<IDomainConfig, IDomainState> {
    return new AdtDomain(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Last-resort cleanup: release every lock still held by handlers created from
   * this client. Returns the locks that could not be released.
   *
   * This is a safety net for abandoned locks (a forgot-to-unlock, or a managed
   * flow that threw before its unlock). Preventing a timeout from interrupting a
   * lock→unlock critical section remains the caller's responsibility.
   */
  async unlockAll(): Promise<LockFailure[]> {
    return this.lockRegistry.unlockAll();
  }

  /**
   * Keys of locks currently held by handlers created from this client
   * (e.g. `Domain/ZFOO`, `DataElement/ZBAR`). Lets a consumer inspect whether a
   * session was left with dangling locks before deciding to `unlockAll()`.
   */
  get pendingLocks(): string[] {
    return this.lockRegistry.pending;
  }

  /**
   * Release all held locks when used with `await using`.
   *
   * Best-effort: like {@link unlockAll}, this never throws — a lock whose unlock
   * fails is retained rather than surfaced as an error, so a disposer failure
   * cannot mask the error that ended the `using` scope. Any residual failures
   * are logged as a warning and remain observable via {@link pendingLocks}.
   * Callers that must react to unlock failures should call `unlockAll()`
   * explicitly and inspect the returned `LockFailure[]`.
   */
  async [Symbol.asyncDispose](): Promise<void> {
    const failures = await this.unlockAll();
    if (failures.length > 0) {
      this.logger.warn(
        `[AdtClient] dispose left ${failures.length} lock(s) unreleased: ${failures
          .map((f) => f.key)
          .join(
            ', ',
          )}. They remain in pendingLocks; retry unlockAll() or rely on session-drop.`,
      );
    }
  }

  /**
   * Get high-level operations for DataElement objects
   * @returns IAdtObject instance for DataElement operations
   */
  getDataElement(): IAdtNonVersionedObject<
    IDataElementConfig,
    IDataElementState
  > {
    return new AdtDataElement(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for AuthorizationField objects
   * @returns IAdtObject instance for AuthorizationField operations
   */
  getAuthorizationField(): IAdtCrud<
    IAuthorizationFieldConfig,
    IAuthorizationFieldState
  > &
    IAdtValidatable<IAuthorizationFieldConfig, IAuthorizationFieldState> &
    IAdtCheckable<IAuthorizationFieldConfig, IAuthorizationFieldState> &
    IAdtActivatable<IAuthorizationFieldConfig, IAuthorizationFieldState> &
    IAdtLockable<IAuthorizationFieldConfig, IAuthorizationFieldState> {
    return new AdtAuthorizationField(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for Structure objects
   * @returns IAdtObject instance for Structure operations
   */
  getStructure(): IAdtSourceObject<IStructureConfig, IStructureState> {
    return new AdtStructure(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for Table objects
   * @returns IAdtObject instance for Table operations
   */
  getTable(): IAdtSourceObject<ITableConfig, ITableState> {
    return new AdtTable(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for TableType (DDIC Table Type) objects
   * @returns IAdtObject instance for TableType operations
   */
  getTableType(): IAdtSourceObject<ITableTypeConfig, ITableTypeState> {
    return new AdtDdicTableType(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Generic client for ABAP DDL source objects (`/sap/bc/adt/ddic/ddl/sources/`):
   * CDS views, AMDP table functions, and other DDL sources. Classic DDIC structures
   * (`/ddic/structures/`), tables (`/ddic/tables/`), and scalar functions
   * (`/ddic/dsfd/sources/`) have their own clients.
   * @returns IAdtObject instance for DDL source operations
   */
  getDdl(): IAdtSourceObject<IDdlConfig, IDdlState> {
    return new AdtDdl(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for FunctionGroup objects
   * @returns IAdtObject instance for FunctionGroup operations
   */
  getFunctionGroup(): IAdtNonVersionedObject<
    IFunctionGroupConfig,
    IFunctionGroupState
  > {
    return new AdtFunctionGroup(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for FunctionModule objects
   * @returns IAdtObject instance for FunctionModule operations
   */
  getFunctionModule(): IAdtSourceObject<
    IFunctionModuleConfig,
    IFunctionModuleState
  > {
    return new AdtFunctionModule(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for FunctionInclude objects
   * @returns IAdtObject instance for FunctionInclude operations
   */
  getFunctionInclude(): IAdtCrud<
    IFunctionIncludeConfig,
    IFunctionIncludeState
  > &
    IAdtValidatable<IFunctionIncludeConfig, IFunctionIncludeState> &
    IAdtCheckable<IFunctionIncludeConfig, IFunctionIncludeState> &
    IAdtActivatable<IFunctionIncludeConfig, IFunctionIncludeState> &
    IAdtLockable<IFunctionIncludeConfig, IFunctionIncludeState> &
    IAdtVersionable<IFunctionIncludeConfig> {
    return new AdtFunctionInclude(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for Package objects
   * @returns IAdtObject instance for Package operations
   */
  getPackage(): IAdtCrud<IPackageConfig, IPackageState> &
    IAdtValidatable<IPackageConfig, IPackageState> &
    IAdtCheckable<IPackageConfig, IPackageState> &
    IAdtLockable<IPackageConfig, IPackageState> &
    IAdtTransportAware<IPackageConfig, IPackageState> {
    return new AdtPackage(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for MessageClass (MSAG/N) objects
   * @returns IAdtObject instance for MessageClass operations
   */
  getMessageClass(): IAdtCrud<IMessageClassConfig, IMessageClassState> &
    IAdtValidatable<IMessageClassConfig, IMessageClassState> &
    IAdtLockable<IMessageClassConfig, IMessageClassState> {
    return new AdtMessageClass(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for a single message within a MessageClass.
   * Supports read, create/update (upsert), and delete of individual messages.
   * @returns IAdtObject instance for MessageClassMessage operations
   */
  getMessageClassMessage(): IAdtCrud<
    IMessageClassMessageConfig,
    IMessageClassMessageState
  > {
    return new AdtMessageClassMessage(this.connection, this.logger);
  }

  /**
   * Get high-level operations for AccessControl objects
   * @returns IAdtObject instance for AccessControl operations
   */
  getAccessControl(): IAdtSourceObject<
    IAccessControlConfig,
    IAccessControlState
  > {
    return new AdtAccessControl(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for Transformation objects (XSLT)
   * Supports both SimpleTransformation and XSLTProgram types
   * @returns IAdtObject instance for Transformation operations
   */
  getTransformation(): IAdtSourceObject<
    ITransformationConfig,
    ITransformationState
  > {
    return new AdtTransformation(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for ServiceDefinition objects
   * @returns IAdtObject instance for ServiceDefinition operations
   */
  getServiceDefinition(): IAdtSourceObject<
    IServiceDefinitionConfig,
    IServiceDefinitionState
  > {
    return new AdtServiceDefinition(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for CDS Scalar Function (DSFD/SCF) objects
   */
  getScalarFunction(): IAdtSourceObject<
    IScalarFunctionConfig,
    IScalarFunctionState
  > {
    return new AdtScalarFunction(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for Scalar Function Implementation (DSFI/SFI) objects
   */
  getScalarFunctionImplementation(): IAdtSourceObject<
    IScalarFunctionImplementationConfig,
    IScalarFunctionImplementationState
  > {
    return new AdtScalarFunctionImplementation(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for Append Structure (TABL/DS) objects
   */
  getAppendStructure(): IAdtSourceObject<
    IAppendStructureConfig,
    IAppendStructureState
  > {
    return new AdtAppendStructure(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for ServiceBinding objects
   * @returns IAdtServiceBinding instance for ServiceBinding CRUD and lifecycle operations
   */
  getServiceBinding(): IAdtServiceBinding {
    return new AdtServiceBinding(
      this.connection,
      this.logger,
      this.systemContext,
    );
  }

  /**
   * @deprecated Use getServiceBinding() instead.
   */
  getService(): IAdtServiceBinding {
    return this.getServiceBinding();
  }

  /**
   * Get high-level operations for BehaviorDefinition objects
   * @returns IAdtObject instance for BehaviorDefinition operations
   */
  getBehaviorDefinition(): IAdtSourceObject<
    IBehaviorDefinitionConfig,
    IBehaviorDefinitionState
  > {
    return new AdtBehaviorDefinition(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for BehaviorImplementation objects
   * @returns IAdtObject instance for BehaviorImplementation operations
   */
  getBehaviorImplementation(): IAdtSourceObject<
    IBehaviorImplementationConfig,
    IBehaviorImplementationState
  > {
    return new AdtBehaviorImplementation(
      this.connection,
      this.logger,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for MetadataExtension objects
   * @returns IAdtObject instance for MetadataExtension operations
   */
  getMetadataExtension(): IAdtSourceObject<
    IMetadataExtensionConfig,
    IMetadataExtensionState
  > {
    return new AdtMetadataExtension(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
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
  getEnhancement(): IAdtSourceObject<IEnhancementConfig, IEnhancementState> {
    return new AdtEnhancement(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for FeatureToggle objects
   * @returns IFeatureToggleObject instance for FeatureToggle operations
   */
  getFeatureToggle(): IFeatureToggleObject {
    return new AdtFeatureToggle(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for UnitTest objects
   * @returns IAdtObject instance for UnitTest operations
   */
  getUnitTest(): IAdtObject<IUnitTestConfig, IUnitTestState> {
    return new AdtUnitTest(this.connection, this.logger);
  }

  /**
   * Get the concrete AdtUnitTest runner (exposes runSync for synchronous,
   * object-based ABAP Unit runs that return a parsed pass/fail summary).
   */
  getUnitTestRunner(): AdtUnitTest {
    return new AdtUnitTest(this.connection, this.logger);
  }

  /**
   * Get high-level operations for ATC (ABAP Test Cockpit) checks
   * @returns AdtAtc instance with worklist+run flow plus convenience methods
   */
  getAtc(): AdtAtc {
    return new AdtAtc(this.connection, this.logger);
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
  getRequest(): AdtRequest {
    return new AdtRequest(this.connection, this.logger, this.systemContext);
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
  getLocalTestClass(): IAdtSourceObject<ILocalTestClassConfig, IClassState> {
    return new AdtLocalTestClass(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for LocalTypes objects
   * @returns IAdtObject instance for LocalTypes operations
   */
  getLocalTypes(): IAdtSourceObject<ILocalTypesConfig, IClassState> {
    return new AdtLocalTypes(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for LocalDefinitions objects
   * @returns IAdtObject instance for LocalDefinitions operations
   */
  getLocalDefinitions(): IAdtSourceObject<
    ILocalDefinitionsConfig,
    IClassState
  > {
    return new AdtLocalDefinitions(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for LocalMacros objects
   * @returns IAdtObject instance for LocalMacros operations
   */
  getLocalMacros(): IAdtSourceObject<ILocalMacrosConfig, IClassState> {
    return new AdtLocalMacros(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
    );
  }
}
