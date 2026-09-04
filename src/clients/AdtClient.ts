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
  IAdtClientOptions,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtCrud,
  IAdtDataPreview,
  IAdtDeletable,
  IAdtDiscovery,
  IAdtGroupLifecycle,
  IAdtInformationSystem,
  IAdtLockable,
  IAdtModifiable,
  IAdtObject,
  IAdtObjectAccess,
  IAdtPackageBrowsing,
  IAdtReadable,
  IAdtRepositoryStructure,
  IAdtRequest,
  IAdtRunnable,
  IAdtSourceObject,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  ICdsTestDoubleCheckable,
  IClassUnitTestDefinition,
  IClassUnitTestRunOptions,
  IIncludeConfig,
  ILogger,
  ISessionLifecycleAware,
  ITestRunInformation,
} from '@mcp-abap-adt/interfaces';
import { ADT_SESSION_ERROR } from '@mcp-abap-adt/interfaces';
import {
  AdtAccessControl,
  accessControlDocuments,
  type IAccessControlConfig,
  type IAccessControlResults,
} from '../core/accessControl';
import {
  AdtAppendStructure,
  appendStructureDocuments,
  type IAppendStructureConfig,
  type IAppendStructureResults,
} from '../core/appendStructure';
import {
  AdtAuthorizationField,
  type IAuthorizationFieldConfig,
  type IAuthorizationFieldState,
} from '../core/authorizationField';
import {
  AdtBehaviorDefinition,
  behaviorDefinitionDocuments,
  type IBehaviorDefinitionConfig,
  type IBehaviorDefinitionResults,
} from '../core/behaviorDefinition';
import {
  AdtBehaviorImplementation,
  classDocuments,
  type IBehaviorImplementationConfig,
  type IClassResults,
} from '../core/behaviorImplementation';
import {
  AdtClass,
  AdtLocalDefinitions,
  AdtLocalMacros,
  AdtLocalTestClass,
  AdtLocalTypes,
  type IClassConfig,
  type ILocalDefinitionsConfig,
  type ILocalMacrosConfig,
  type ILocalTestClassConfig,
  type ILocalTypesConfig,
} from '../core/class';
import {
  AdtDataElement,
  dataElementDocuments,
  type IDataElementConfig,
  type IDataElementResults,
} from '../core/dataElement';
import {
  AdtDdl,
  ddlDocuments,
  type IDdlConfig,
  type IDdlResults,
} from '../core/ddl';
import {
  AdtDomain,
  domainDocuments,
  type IDomainConfig,
  type IDomainResults,
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
  functionGroupDocuments,
  type IFunctionGroupConfig,
  type IFunctionGroupResults,
} from '../core/functionGroup';
import {
  AdtFunctionInclude,
  functionIncludeDocuments,
  type IFunctionIncludeConfig,
  type IFunctionIncludeResults,
} from '../core/functionInclude';
import {
  AdtFunctionModule,
  functionModuleDocuments,
  type IFunctionModuleConfig,
  type IFunctionModuleResults,
} from '../core/functionModule';
import {
  AdtInclude,
  type IIncludeResults,
  includeDocuments,
} from '../core/include';
import {
  AdtInterface,
  type IInterfaceConfig,
  type IInterfaceResults,
  interfaceDocuments,
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
  type IMetadataExtensionResults,
  metadataExtensionDocuments,
} from '../core/metadataExtension';
import {
  AdtPackage,
  type IPackageConfig,
  type IPackageState,
} from '../core/package';
import {
  AdtProgram,
  type IProgramConfig,
  type IProgramResults,
  programDocuments,
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
import {
  AdtServiceBinding,
  type IServiceResults,
  serviceDocuments,
} from '../core/service';
import {
  AdtServiceDefinition,
  type IServiceDefinitionConfig,
  type IServiceDefinitionResults,
  serviceDefinitionDocuments,
} from '../core/serviceDefinition';
import { AdtUtils } from '../core/shared/AdtUtils';
import { type LockFailure, LockRegistry } from '../core/shared/LockRegistry';
import type { ObjectVersion } from '../core/shared/results';
import {
  AdtStructure,
  type IStructureConfig,
  type IStructureResults,
  structureDocuments,
} from '../core/structure';
import {
  AdtTable,
  type ITableConfig,
  type ITableResults,
  tableDocuments,
} from '../core/table';
import {
  AdtDdicTableType,
  type ITableTypeConfig,
  type ITableTypeResults,
  tableTypeDocuments,
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
import { withRefusalDetection } from '../utils/refusalAware';

export class AdtClient {
  protected connection: IAbapConnection;
  protected logger: ILogger;
  protected systemContext: IAdtSystemContext;
  protected contentTypes?: IAdtContentTypes;
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
    // Wrapped once, here, where a connection enters the library. A refusal SAP
    // sends with a 2xx would otherwise be stored as a result and reported as
    // success — see src/utils/refusalAware.ts for what that measured.
    this.connection = withRefusalDetection(connection);
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
   * Refuses to hand out a handler over a connection nobody connected.
   *
   * Connecting is the CONSUMER's job and stays that way — this library does not
   * own the connection and must not connect on anyone's behalf. What it can do
   * is catch the case where a connector was injected and `connect()` was never
   * called, which otherwise surfaces deep in an operation chain: the handlers
   * collect failures into `state.errors` rather than stopping, so a missing
   * connection arrives as a state object full of `ADT_NOT_CONNECTED` after the
   * chain has walked its whole length. Failing here turns that into nothing
   * having happened at all.
   *
   * Only asked of a connection that ANSWERS the question. `isConnected()` lives
   * on `ISessionLifecycleAware`, not on `IAbapConnection`: an RFC connection has
   * no HTTP session and no such method, and a transport that cannot answer must
   * not be blocked on its silence. This is a real limit, not an oversight — a
   * transport with no session has no "not connected" state to catch, so the
   * promise this guard makes is necessarily narrower than "every
   * `IAbapConnection`".
   *
   * It checks ONLY `isConnected`, which is the only method it calls. That is a
   * different rule from the one for a type predicate, and the difference is
   * worth stating because the two look alike: a predicate narrows to the WHOLE
   * interface, so it must verify the whole interface or its caller will invoke a
   * method that is not there. This asks one question and calls one method, so
   * demanding the other two would only make it step aside for a connection that
   * could have answered — refusing evidence it was offered.
   */
  private assertConnected(): void {
    const candidate = this.connection as Partial<ISessionLifecycleAware>;
    if (typeof candidate.isConnected !== 'function') return;

    if (!candidate.isConnected()) {
      const error = new Error(
        'AdtClient: the connection is not connected. Call connect() on it before ' +
          'requesting a handler — this library does not connect on your behalf.',
      ) as Error & { code: string };
      error.code = ADT_SESSION_ERROR.NOT_CONNECTED;
      throw error;
    }
  }

  /**
   * A class implementation, answering documents.
   *
   * The result strategy is chosen here rather than per call because a consumer
   * that wants a particular shape wants it for every member it touches, and
   * none of them changes its mind between `create` and `read` of the same
   * object. The return type is this package's — which is why
   * `@mcp-abap-adt/interfaces` needs no parser parameter to make this possible.
   */
  getClass(): AdtClass;
  getClass<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IClassConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IClassConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IClassConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IClassConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IClassConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IClassConfig, ReturnType<R['check']>> &
    IAdtActivatable<IClassConfig, ReturnType<R['activation']>> &
    IAdtLockable<IClassConfig> &
    IAdtVersionable<IClassConfig, ObjectVersion[], string>;
  // The implementation is generic too. Erasing R here would build the object at
  // `unknown` while the overload promised `ReturnType<R['source']>` — the
  // factory telling the truth in its signature and lying in its body.
  getClass<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IClassResults,
  >(results: R = classDocuments as unknown as R): AdtClass<R> {
    this.assertConnected();
    return new AdtClass<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Program objects
   * @returns IAdtObject instance for Program operations
   */
  getProgram(): AdtProgram;
  getProgram<
    R extends IProgramResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IProgramConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IProgramConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IProgramConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IProgramConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IProgramConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IProgramConfig, ReturnType<R['check']>> &
    IAdtActivatable<IProgramConfig, ReturnType<R['activation']>> &
    IAdtLockable<IProgramConfig> &
    IAdtTransportAware<IProgramConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IProgramConfig, ObjectVersion[], string>;
  getProgram<
    R extends IProgramResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IProgramResults,
  >(results: R = programDocuments as unknown as R): AdtProgram<R> {
    this.assertConnected();
    return new AdtProgram<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Standalone `PROG/I` includes.
   *
   * A different resource from a program and from a function-group include —
   * see `src/core/include/index.ts` for the three-way comparison. The return
   * type names only the capabilities an include has: nothing measured says it
   * is versionable, so it does not claim to be.
   *
   * Creatable on modern on-prem only, where discovery gives the includes
   * collection an `app:accept`.
   */
  getInclude(): AdtInclude;
  getInclude<
    R extends IIncludeResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IIncludeConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IIncludeConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IIncludeConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IIncludeConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IIncludeConfig, ReturnType<R['validation']>> &
    IAdtActivatable<IIncludeConfig, ReturnType<R['activation']>> &
    IAdtLockable<IIncludeConfig>;
  getInclude<
    R extends IIncludeResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IIncludeResults,
  >(results: R = includeDocuments as unknown as R): AdtInclude<R> {
    this.assertConnected();
    return new AdtInclude<R>(
      this.connection,
      this.logger,
      this.contentTypes,
      results,
    );
  }

  /**
   * Get high-level operations for Interface objects
   * @returns IAdtObject instance for Interface operations
   */
  getInterface(): AdtInterface;
  getInterface<
    R extends IInterfaceResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IInterfaceConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IInterfaceConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IInterfaceConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IInterfaceConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IInterfaceConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IInterfaceConfig, ReturnType<R['check']>> &
    IAdtActivatable<IInterfaceConfig, ReturnType<R['activation']>> &
    IAdtLockable<IInterfaceConfig> &
    IAdtTransportAware<IInterfaceConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IInterfaceConfig, ObjectVersion[], string>;
  getInterface<
    R extends IInterfaceResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IInterfaceResults,
  >(results: R = interfaceDocuments as unknown as R): AdtInterface<R> {
    this.assertConnected();
    return new AdtInterface<R>(
      this.connection,
      this.logger,
      this.systemContext,
      undefined,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Domain objects
   * @returns IAdtObject instance for Domain operations
   */
  getDomain(): AdtDomain;
  getDomain<
    R extends IDomainResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IDomainConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IDomainConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IDomainConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IDomainConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IDomainConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IDomainConfig, ReturnType<R['check']>> &
    IAdtActivatable<IDomainConfig, ReturnType<R['activation']>> &
    IAdtLockable<IDomainConfig> &
    IAdtTransportAware<IDomainConfig, ReturnType<R['transport']>>;
  getDomain<
    R extends IDomainResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IDomainResults,
  >(results: R = domainDocuments as unknown as R): AdtDomain<R> {
    this.assertConnected();
    return new AdtDomain<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
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
  getDataElement(): AdtDataElement;
  getDataElement<
    R extends IDataElementResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IDataElementConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IDataElementConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IDataElementConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IDataElementConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IDataElementConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IDataElementConfig, ReturnType<R['check']>> &
    IAdtActivatable<IDataElementConfig, ReturnType<R['activation']>> &
    IAdtLockable<IDataElementConfig> &
    IAdtTransportAware<IDataElementConfig, ReturnType<R['transport']>>;
  getDataElement<
    R extends IDataElementResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IDataElementResults,
  >(results: R = dataElementDocuments as unknown as R): AdtDataElement<R> {
    this.assertConnected();
    return new AdtDataElement<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
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
    this.assertConnected();
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
  getStructure(): AdtStructure;
  getStructure<
    R extends IStructureResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IStructureConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IStructureConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IStructureConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IStructureConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IStructureConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IStructureConfig, ReturnType<R['check']>> &
    IAdtActivatable<IStructureConfig, ReturnType<R['activation']>> &
    IAdtLockable<IStructureConfig> &
    IAdtTransportAware<IStructureConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IStructureConfig, ObjectVersion[], string>;
  getStructure<
    R extends IStructureResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IStructureResults,
  >(results: R = structureDocuments as unknown as R): AdtStructure<R> {
    this.assertConnected();
    return new AdtStructure<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Table objects
   * @returns IAdtObject instance for Table operations
   */
  getTable(): AdtTable;
  getTable<
    R extends ITableResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<ITableConfig, ReturnType<R['created']>> &
    IAdtReadable<
      ITableConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<ITableConfig, ReturnType<R['updated']>> &
    IAdtDeletable<ITableConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<ITableConfig, ReturnType<R['validation']>> &
    IAdtCheckable<ITableConfig, ReturnType<R['check']>> &
    IAdtActivatable<ITableConfig, ReturnType<R['activation']>> &
    IAdtLockable<ITableConfig> &
    IAdtTransportAware<ITableConfig, ReturnType<R['transport']>> &
    IAdtVersionable<ITableConfig, ObjectVersion[], string>;
  getTable<
    R extends ITableResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = ITableResults,
  >(results: R = tableDocuments as unknown as R): AdtTable<R> {
    this.assertConnected();
    return new AdtTable<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for TableType (DDIC Table Type) objects
   * @returns IAdtObject instance for TableType operations
   */
  getTableType(): AdtDdicTableType;
  getTableType<
    R extends ITableTypeResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<ITableTypeConfig, ReturnType<R['created']>> &
    IAdtReadable<
      ITableTypeConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<ITableTypeConfig, ReturnType<R['updated']>> &
    IAdtDeletable<ITableTypeConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<ITableTypeConfig, ReturnType<R['validation']>> &
    IAdtCheckable<ITableTypeConfig, ReturnType<R['check']>> &
    IAdtActivatable<ITableTypeConfig, ReturnType<R['activation']>> &
    IAdtLockable<ITableTypeConfig> &
    IAdtTransportAware<ITableTypeConfig, ReturnType<R['transport']>> &
    IAdtVersionable<ITableTypeConfig, ObjectVersion[], string>;
  getTableType<
    R extends ITableTypeResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = ITableTypeResults,
  >(results: R = tableTypeDocuments as unknown as R): AdtDdicTableType<R> {
    this.assertConnected();
    return new AdtDdicTableType<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Generic client for ABAP DDL source objects (`/sap/bc/adt/ddic/ddl/sources/`):
   * CDS views, AMDP table functions, and other DDL sources. Classic DDIC structures
   * (`/ddic/structures/`), tables (`/ddic/tables/`), and scalar functions
   * (`/ddic/dsfd/sources/`) have their own clients.
   * @returns IAdtObject instance for DDL source operations
   */
  getDdl(): AdtDdl;
  getDdl<
    R extends IDdlResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IDdlConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IDdlConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IDdlConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IDdlConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IDdlConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IDdlConfig, ReturnType<R['check']>> &
    IAdtActivatable<IDdlConfig, ReturnType<R['activation']>> &
    IAdtLockable<IDdlConfig> &
    IAdtTransportAware<IDdlConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IDdlConfig, ObjectVersion[], string>;
  getDdl<
    R extends IDdlResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IDdlResults,
  >(results: R = ddlDocuments as unknown as R): AdtDdl<R> {
    this.assertConnected();
    return new AdtDdl<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for FunctionGroup objects
   * @returns IAdtObject instance for FunctionGroup operations
   */
  getFunctionGroup(): AdtFunctionGroup;
  getFunctionGroup<
    R extends IFunctionGroupResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IFunctionGroupConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IFunctionGroupConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IFunctionGroupConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IFunctionGroupConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IFunctionGroupConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IFunctionGroupConfig, ReturnType<R['check']>> &
    IAdtActivatable<IFunctionGroupConfig, ReturnType<R['activation']>> &
    IAdtLockable<IFunctionGroupConfig> &
    IAdtTransportAware<IFunctionGroupConfig, ReturnType<R['transport']>>;
  getFunctionGroup<
    R extends IFunctionGroupResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IFunctionGroupResults,
  >(results: R = functionGroupDocuments as unknown as R): AdtFunctionGroup<R> {
    this.assertConnected();
    return new AdtFunctionGroup<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for FunctionModule objects
   * @returns IAdtObject instance for FunctionModule operations
   */
  getFunctionModule(): AdtFunctionModule;
  getFunctionModule<
    R extends IFunctionModuleResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IFunctionModuleConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IFunctionModuleConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IFunctionModuleConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IFunctionModuleConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IFunctionModuleConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IFunctionModuleConfig, ReturnType<R['check']>> &
    IAdtActivatable<IFunctionModuleConfig, ReturnType<R['activation']>> &
    IAdtLockable<IFunctionModuleConfig> &
    IAdtTransportAware<IFunctionModuleConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IFunctionModuleConfig, ObjectVersion[], string>;
  getFunctionModule<
    R extends IFunctionModuleResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IFunctionModuleResults,
  >(
    results: R = functionModuleDocuments as unknown as R,
  ): AdtFunctionModule<R> {
    this.assertConnected();
    return new AdtFunctionModule<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for FunctionInclude objects
   * @returns IAdtObject instance for FunctionInclude operations
   */
  getFunctionInclude(): AdtFunctionInclude;
  getFunctionInclude<
    R extends IFunctionIncludeResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IFunctionIncludeConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IFunctionIncludeConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IFunctionIncludeConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IFunctionIncludeConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IFunctionIncludeConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IFunctionIncludeConfig, ReturnType<R['check']>> &
    IAdtActivatable<IFunctionIncludeConfig, ReturnType<R['activation']>> &
    IAdtLockable<IFunctionIncludeConfig> &
    IAdtVersionable<IFunctionIncludeConfig, ObjectVersion[], string>;
  getFunctionInclude<
    R extends IFunctionIncludeResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IFunctionIncludeResults,
  >(
    results: R = functionIncludeDocuments as unknown as R,
  ): AdtFunctionInclude<R> {
    this.assertConnected();
    return new AdtFunctionInclude<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
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
    this.assertConnected();
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
    this.assertConnected();
    return new AdtMessageClass(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for a single message within a MessageClass.
   *
   * A message class (MSAG) is not an ABAP class, whatever the name suggests,
   * and a message inside one is an entity that is genuinely created: it does
   * not exist until someone adds it. So this keeps `create` — unlike a class's
   * includes, which exist because their class does.
   */
  getMessageClassMessage(): IAdtCrud<
    IMessageClassMessageConfig,
    IMessageClassMessageState
  > {
    this.assertConnected();
    return new AdtMessageClassMessage(this.connection, this.logger);
  }

  /**
   * Get high-level operations for AccessControl objects
   * @returns IAdtObject instance for AccessControl operations
   */
  getAccessControl(): AdtAccessControl;
  getAccessControl<
    R extends IAccessControlResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IAccessControlConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IAccessControlConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IAccessControlConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IAccessControlConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IAccessControlConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IAccessControlConfig, ReturnType<R['check']>> &
    IAdtActivatable<IAccessControlConfig, ReturnType<R['activation']>> &
    IAdtLockable<IAccessControlConfig> &
    IAdtTransportAware<IAccessControlConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IAccessControlConfig, ObjectVersion[], string>;
  getAccessControl<
    R extends IAccessControlResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IAccessControlResults,
  >(results: R = accessControlDocuments as unknown as R): AdtAccessControl<R> {
    this.assertConnected();
    return new AdtAccessControl<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
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
    this.assertConnected();
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
  getServiceDefinition(): AdtServiceDefinition;
  getServiceDefinition<
    R extends IServiceDefinitionResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IServiceDefinitionConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IServiceDefinitionConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IServiceDefinitionConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IServiceDefinitionConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IServiceDefinitionConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IServiceDefinitionConfig, ReturnType<R['check']>> &
    IAdtActivatable<IServiceDefinitionConfig, ReturnType<R['activation']>> &
    IAdtLockable<IServiceDefinitionConfig> &
    IAdtTransportAware<IServiceDefinitionConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IServiceDefinitionConfig, ObjectVersion[], string>;
  getServiceDefinition<
    R extends IServiceDefinitionResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IServiceDefinitionResults,
  >(
    results: R = serviceDefinitionDocuments as unknown as R,
  ): AdtServiceDefinition<R> {
    this.assertConnected();
    return new AdtServiceDefinition<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for CDS Scalar Function (DSFD/SCF) objects
   */
  getScalarFunction(): IAdtSourceObject<
    IScalarFunctionConfig,
    IScalarFunctionState
  > {
    this.assertConnected();
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
    this.assertConnected();
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
  getAppendStructure(): AdtAppendStructure;
  getAppendStructure<
    R extends IAppendStructureResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IAppendStructureConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IAppendStructureConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IAppendStructureConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IAppendStructureConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IAppendStructureConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IAppendStructureConfig, ReturnType<R['check']>> &
    IAdtActivatable<IAppendStructureConfig, ReturnType<R['activation']>> &
    IAdtLockable<IAppendStructureConfig> &
    IAdtTransportAware<IAppendStructureConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IAppendStructureConfig, ObjectVersion[], string>;
  getAppendStructure<
    R extends IAppendStructureResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IAppendStructureResults,
  >(
    results: R = appendStructureDocuments as unknown as R,
  ): AdtAppendStructure<R> {
    this.assertConnected();
    return new AdtAppendStructure<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for ServiceBinding objects
   * @returns IAdtServiceBinding instance for ServiceBinding CRUD and lifecycle operations
   */
  getServiceBinding(): AdtServiceBinding;
  getServiceBinding<R extends IServiceResults>(
    results: R,
  ): AdtServiceBinding<R>;
  getServiceBinding<R extends IServiceResults = typeof serviceDocuments>(
    results: R = serviceDocuments as unknown as R,
  ): AdtServiceBinding<R> {
    this.assertConnected();
    return new AdtServiceBinding<R>(
      this.connection,
      this.logger,
      this.systemContext,
      results,
    );
  }

  /**
   * @deprecated Use getServiceBinding() instead.
   */
  getService(): AdtServiceBinding {
    return this.getServiceBinding();
  }

  /**
   * Get high-level operations for BehaviorDefinition objects
   * @returns IAdtObject instance for BehaviorDefinition operations
   */
  getBehaviorDefinition(): AdtBehaviorDefinition;
  getBehaviorDefinition<
    R extends IBehaviorDefinitionResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IBehaviorDefinitionConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IBehaviorDefinitionConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IBehaviorDefinitionConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IBehaviorDefinitionConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IBehaviorDefinitionConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IBehaviorDefinitionConfig, ReturnType<R['check']>> &
    IAdtActivatable<IBehaviorDefinitionConfig, ReturnType<R['activation']>> &
    IAdtLockable<IBehaviorDefinitionConfig> &
    IAdtTransportAware<IBehaviorDefinitionConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IBehaviorDefinitionConfig, ObjectVersion[], string>;
  getBehaviorDefinition<
    R extends IBehaviorDefinitionResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IBehaviorDefinitionResults,
  >(
    results: R = behaviorDefinitionDocuments as unknown as R,
  ): AdtBehaviorDefinition<R> {
    this.assertConnected();
    return new AdtBehaviorDefinition<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for BehaviorImplementation objects
   * @returns IAdtObject instance for BehaviorImplementation operations
   */
  getBehaviorImplementation(): AdtBehaviorImplementation;
  getBehaviorImplementation<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IBehaviorImplementationConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IBehaviorImplementationConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IBehaviorImplementationConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IBehaviorImplementationConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<
      IBehaviorImplementationConfig,
      ReturnType<R['validation']>
    > &
    IAdtCheckable<IBehaviorImplementationConfig, ReturnType<R['check']>> &
    IAdtActivatable<
      IBehaviorImplementationConfig,
      ReturnType<R['activation']>
    > &
    IAdtLockable<IBehaviorImplementationConfig> &
    IAdtTransportAware<IBehaviorImplementationConfig, string> &
    IAdtVersionable<IBehaviorImplementationConfig, ObjectVersion[], string>;
  getBehaviorImplementation<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IClassResults,
  >(results: R = classDocuments as unknown as R): AdtBehaviorImplementation<R> {
    this.assertConnected();
    return new AdtBehaviorImplementation<R>(
      this.connection,
      this.logger,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for MetadataExtension objects
   * @returns IAdtObject instance for MetadataExtension operations
   */
  getMetadataExtension(): AdtMetadataExtension;
  getMetadataExtension<
    R extends IMetadataExtensionResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtCreatable<IMetadataExtensionConfig, ReturnType<R['created']>> &
    IAdtReadable<
      IMetadataExtensionConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    > &
    IAdtUpdatable<IMetadataExtensionConfig, ReturnType<R['updated']>> &
    IAdtDeletable<IMetadataExtensionConfig, ReturnType<R['deletion']>> &
    IAdtValidatable<IMetadataExtensionConfig, ReturnType<R['validation']>> &
    IAdtCheckable<IMetadataExtensionConfig, ReturnType<R['check']>> &
    IAdtActivatable<IMetadataExtensionConfig, ReturnType<R['activation']>> &
    IAdtLockable<IMetadataExtensionConfig> &
    IAdtTransportAware<IMetadataExtensionConfig, ReturnType<R['transport']>> &
    IAdtVersionable<IMetadataExtensionConfig, ObjectVersion[], string>;
  getMetadataExtension<
    R extends IMetadataExtensionResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IMetadataExtensionResults,
  >(
    results: R = metadataExtensionDocuments as unknown as R,
  ): AdtMetadataExtension<R> {
    this.assertConnected();
    return new AdtMetadataExtension<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
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
    this.assertConnected();
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
    this.assertConnected();
    return new AdtFeatureToggle(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
    );
  }

  /**
   * Get high-level operations for UnitTest objects.
   *
   * A test run is created and read, never edited: ADT exposes no update,
   * delete, activate, check, lock or version resource for one. The declared
   * type says so rather than promising thirteen methods of which nine throw.
   *
   * It also carries {@link IAdtTestRunnable} — starting a run and collecting
   * its outcome is the reason this handler exists, and until interfaces 13.1.0
   * no contract described it, so callers cast past the type to reach it.
   */
  getUnitTest(): IAdtCreatable<IUnitTestConfig, IUnitTestState> &
    IAdtReadable<IUnitTestConfig, IUnitTestState> &
    IAdtUpdatable<IUnitTestConfig, IUnitTestState> &
    IAdtDeletable<IUnitTestConfig, IUnitTestState> &
    IAdtValidatable<IUnitTestConfig, IUnitTestState> &
    IAdtLockable<IUnitTestConfig, IUnitTestState> &
    IAdtRunnable<IClassUnitTestDefinition[], string, IClassUnitTestRunOptions> &
    ITestRunInformation {
    this.assertConnected();
    return new AdtUnitTest(this.connection, this.logger);
  }

  /**
   * Get high-level operations for CDS UnitTest objects.
   *
   * Same capability set as {@link getUnitTest}; the CDS-specific surface
   * (`checkCdsTestDoubles`, `getCdsViewName`) is on the concrete class.
   */
  getCdsUnitTest(): IAdtCreatable<ICdsUnitTestConfig, ICdsUnitTestState> &
    IAdtReadable<ICdsUnitTestConfig, ICdsUnitTestState> &
    IAdtUpdatable<ICdsUnitTestConfig, ICdsUnitTestState> &
    IAdtDeletable<ICdsUnitTestConfig, ICdsUnitTestState> &
    IAdtValidatable<ICdsUnitTestConfig, ICdsUnitTestState> &
    IAdtLockable<ICdsUnitTestConfig, ICdsUnitTestState> &
    IAdtRunnable<
      IClassUnitTestDefinition[] | string,
      string,
      IClassUnitTestRunOptions
    > &
    ITestRunInformation &
    ICdsTestDoubleCheckable {
    this.assertConnected();
    return new AdtCdsUnitTest(this.connection, this.logger);
  }

  /**
   * Get high-level operations for Request (Transport Request) objects.
   *
   * Declared as `IAdtRequest`, not as the class, so the compiler checks the
   * handler here. `AdtRequest` has to satisfy the contract at this line: remove
   * a method from it and the build fails *here*, rather than only where
   * something happens to call it — and a method with no internal caller could
   * otherwise vanish while every consumer lost it.
   *
   * A consumer can also substitute their own handler and compose the contract
   * with their own types, neither of which is possible against a class.
   *
   * Not because the capability guard could not see the concrete return: it
   * could. Its check is structural and fails identically either way — see
   * decision 10 in `docs/architecture/DECISIONS.md`, which keeps that wrong
   * reason beside the right one.
   *
   * @returns the transport request contract
   */
  getRequest(): IAdtRequest {
    this.assertConnected();
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
   * Returns the seven atoms, spelled as an intersection rather than named —
   * there is no composite for "all of them", because a composite would be a
   * capability claim nobody makes: a consumer takes the family they need.
   *
   * A contract and not `AdtUtils`, for the reason decision 10 gives: a class as a
   * return type satisfies itself by definition, so the factory compiles whatever
   * the class happens to be that day. This makes the compiler check the handler
   * where it is handed out — and it caught two members returning the envelope
   * while the contract promised a parsed result.
   *
   * Narrower than the class on purpose. `searchObjects`, `getWhereUsed` and
   * `getPackageContents` stay on `AdtUtils` and are not here: each issues the
   * same request as a sibling that has a contract, and one endpoint is one member
   * (decision 16 in `@mcp-abap-adt/interfaces`). A caller who needs the raw
   * document passes a parser to the sibling.
   *
   * @returns The cross-cutting operations, as contracts
   */
  getUtils(): IAdtInformationSystem &
    IAdtRepositoryStructure &
    IAdtPackageBrowsing &
    IAdtGroupLifecycle &
    IAdtDataPreview &
    IAdtDiscovery &
    IAdtObjectAccess {
    this.assertConnected();
    return new AdtUtils(this.connection, this.logger);
  }

  /**
   * Get high-level operations for a class's `testclasses` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  getLocalTestClass(): AdtLocalTestClass;
  getLocalTestClass<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtReadable<
    ILocalTestClassConfig,
    ReturnType<R['source']>,
    ReturnType<R['metadata']>
  > &
    IAdtUpdatable<ILocalTestClassConfig, ReturnType<R['updated']>> &
    IAdtDeletable<ILocalTestClassConfig, ReturnType<R['updated']>> &
    IAdtValidatable<ILocalTestClassConfig, ReturnType<R['validation']>> &
    IAdtCheckable<ILocalTestClassConfig, ReturnType<R['check']>> &
    IAdtActivatable<ILocalTestClassConfig, ReturnType<R['activation']>> &
    IAdtLockable<ILocalTestClassConfig> &
    IAdtVersionable<ILocalTestClassConfig, ObjectVersion[], string> &
    IAdtTransportAware<ILocalTestClassConfig, string>;
  getLocalTestClass<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IClassResults,
  >(results: R = classDocuments as unknown as R): AdtLocalTestClass<R> {
    this.assertConnected();
    return new AdtLocalTestClass<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for a class's `localtypes` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  getLocalTypes(): AdtLocalTypes;
  getLocalTypes<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtReadable<
    ILocalTypesConfig,
    ReturnType<R['source']>,
    ReturnType<R['metadata']>
  > &
    IAdtUpdatable<ILocalTypesConfig, ReturnType<R['updated']>> &
    IAdtDeletable<ILocalTypesConfig, ReturnType<R['updated']>> &
    IAdtValidatable<ILocalTypesConfig, ReturnType<R['validation']>> &
    IAdtCheckable<ILocalTypesConfig, ReturnType<R['check']>> &
    IAdtActivatable<ILocalTypesConfig, ReturnType<R['activation']>> &
    IAdtLockable<ILocalTypesConfig> &
    IAdtVersionable<ILocalTypesConfig, ObjectVersion[], string> &
    IAdtTransportAware<ILocalTypesConfig, string>;
  getLocalTypes<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IClassResults,
  >(results: R = classDocuments as unknown as R): AdtLocalTypes<R> {
    this.assertConnected();
    return new AdtLocalTypes<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for a class's `definitions` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  getLocalDefinitions(): AdtLocalDefinitions;
  getLocalDefinitions<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtReadable<
    ILocalDefinitionsConfig,
    ReturnType<R['source']>,
    ReturnType<R['metadata']>
  > &
    IAdtUpdatable<ILocalDefinitionsConfig, ReturnType<R['updated']>> &
    IAdtDeletable<ILocalDefinitionsConfig, ReturnType<R['updated']>> &
    IAdtValidatable<ILocalDefinitionsConfig, ReturnType<R['validation']>> &
    IAdtCheckable<ILocalDefinitionsConfig, ReturnType<R['check']>> &
    IAdtActivatable<ILocalDefinitionsConfig, ReturnType<R['activation']>> &
    IAdtLockable<ILocalDefinitionsConfig> &
    IAdtVersionable<ILocalDefinitionsConfig, ObjectVersion[], string> &
    IAdtTransportAware<ILocalDefinitionsConfig, string>;
  getLocalDefinitions<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IClassResults,
  >(results: R = classDocuments as unknown as R): AdtLocalDefinitions<R> {
    this.assertConnected();
    return new AdtLocalDefinitions<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for a class's `macros` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  getLocalMacros(): AdtLocalMacros;
  getLocalMacros<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    >,
  >(
    results: R,
  ): IAdtReadable<
    ILocalMacrosConfig,
    ReturnType<R['source']>,
    ReturnType<R['metadata']>
  > &
    IAdtUpdatable<ILocalMacrosConfig, ReturnType<R['updated']>> &
    IAdtDeletable<ILocalMacrosConfig, ReturnType<R['updated']>> &
    IAdtValidatable<ILocalMacrosConfig, ReturnType<R['validation']>> &
    IAdtCheckable<ILocalMacrosConfig, ReturnType<R['check']>> &
    IAdtActivatable<ILocalMacrosConfig, ReturnType<R['activation']>> &
    IAdtLockable<ILocalMacrosConfig> &
    IAdtVersionable<ILocalMacrosConfig, ObjectVersion[], string> &
    IAdtTransportAware<ILocalMacrosConfig, string>;
  getLocalMacros<
    R extends IClassResults<
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown
    > = IClassResults,
  >(results: R = classDocuments as unknown as R): AdtLocalMacros<R> {
    this.assertConnected();
    return new AdtLocalMacros<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }
}
