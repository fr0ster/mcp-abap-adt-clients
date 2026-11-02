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
 * Each factory answers its own handler class (`AdtClass<ResultValuesOf<R>>`, …) over the
 * result set it is given, or the shipped default without one. This package
 * declares no composition of the atoms: a consumer composes the contract it
 * accepts from `@mcp-abap-adt/interfaces-adt`, and the compiler checks there
 * that a client satisfies it.
 */

import type {
  AdtVariant,
  IAccessControlResults,
  IAdtClientOptions,
  IAdtContentTypes,
  IAdtSystemContext,
  IAppendStructureResults,
  IAuthorizationFieldResults,
  IBehaviorDefinitionResults,
  IClassResults,
  IDataElementResults,
  IDdlResults,
  IDomainResults,
  IEnhancementResults,
  IFeatureToggleResults,
  IFunctionGroupResults,
  IFunctionIncludeResults,
  IFunctionModuleResults,
  IIncludeResults,
  IInterfaceResults,
  IMessageClassMessageResults,
  IMessageClassResults,
  IMetadataExtensionResults,
  IPackageResults,
  IProgramResults,
  IScalarFunctionImplementationResults,
  IScalarFunctionResults,
  IServiceDefinitionResults,
  IServiceResults,
  IStructureResults,
  ITableResults,
  ITableTypeResults,
  ITransformationResults,
  ITransportResults,
  IUtilResults,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ADT_SESSION_ERROR } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  type AccessControlValues,
  AdtAccessControl,
  accessControlDocuments,
} from '../core/accessControl';
import {
  AdtAppendStructure,
  type AppendStructureValues,
  appendStructureDocuments,
} from '../core/appendStructure';
import {
  AdtAuthorizationField,
  type AuthorizationFieldValues,
  authorizationFieldDocuments,
} from '../core/authorizationField';
import {
  AdtBehaviorDefinition,
  type BehaviorDefinitionValues,
  behaviorDefinitionDocuments,
} from '../core/behaviorDefinition';
import {
  AdtBehaviorImplementation,
  classDocuments,
} from '../core/behaviorImplementation';
import {
  AdtClass,
  AdtLocalDefinitions,
  AdtLocalMacros,
  AdtLocalTestClass,
  AdtLocalTypes,
  type ClassValues,
} from '../core/class';
import {
  AdtDataElement,
  type DataElementValues,
  dataElementDocuments,
} from '../core/dataElement';
import { AdtDdl, type DdlValues, ddlDocuments } from '../core/ddl';
import { AdtDomain, type DomainValues, domainDocuments } from '../core/domain';
import {
  AdtEnhancement,
  type EnhancementValues,
  enhancementDocuments,
} from '../core/enhancement';
import {
  AdtFeatureToggle,
  type FeatureToggleValues,
  featureToggleDocuments,
} from '../core/featureToggle';
import {
  AdtFunctionGroup,
  type FunctionGroupValues,
  functionGroupDocuments,
} from '../core/functionGroup';
import {
  AdtFunctionInclude,
  type FunctionIncludeValues,
  functionIncludeDocuments,
} from '../core/functionInclude';
import {
  AdtFunctionModule,
  type FunctionModuleValues,
  functionModuleDocuments,
} from '../core/functionModule';
import {
  AdtInclude,
  type IncludeValues,
  includeDocuments,
} from '../core/include';
import {
  AdtInterface,
  type InterfaceValues,
  interfaceDocuments,
} from '../core/interface';
import {
  AdtMessageClass,
  AdtMessageClassMessage,
  type MessageClassMessageValues,
  type MessageClassValues,
  messageClassDocuments,
  messageDocuments,
} from '../core/messageClass';
import {
  AdtMetadataExtension,
  type MetadataExtensionValues,
  metadataExtensionDocuments,
} from '../core/metadataExtension';
import {
  AdtPackage,
  type PackageValues,
  packageDocuments,
} from '../core/package';
import {
  AdtProgram,
  type ProgramValues,
  programDocuments,
} from '../core/program';
import {
  AdtScalarFunction,
  type ScalarFunctionValues,
  scalarFunctionDocuments,
} from '../core/scalarFunction';
import {
  AdtScalarFunctionImplementation,
  type ScalarFunctionImplementationValues,
  scalarFunctionImplementationDocuments,
} from '../core/scalarFunctionImplementation';
import {
  AdtServiceBinding,
  type ServiceValues,
  serviceDocuments,
} from '../core/service';
import {
  AdtServiceDefinition,
  type ServiceDefinitionValues,
  serviceDefinitionDocuments,
} from '../core/serviceDefinition';
import { AdtUtils, type UtilValues } from '../core/shared/AdtUtils';
import { type LockFailure, LockRegistry } from '../core/shared/LockRegistry';
import { utilDocuments } from '../core/shared/utilResultSet';
import {
  AdtStructure,
  type StructureValues,
  structureDocuments,
} from '../core/structure';
import { AdtTable, type TableValues, tableDocuments } from '../core/table';
import {
  AdtDdicTableType,
  type TableTypeValues,
  tableTypeDocuments,
} from '../core/tabletype';
import {
  AdtTransformation,
  type TransformationValues,
  transformationDocuments,
} from '../core/transformation';
import {
  AdtRequest,
  type TransportValues,
  transportDocuments,
} from '../core/transport';
import { withRequestTrace } from '../utils/requestTrace';
import type { ResultValuesOf } from '../utils/resultStrategy';
import type { AdtModernVariant, AdtServedBy } from './variant';

/**
 * Whether the connection answers `isConnected()` — the one member of the
 * contract's `ISessionLifecycleAware` that `assertConnected` calls, and so the
 * one this checks and narrows to (see there for why not the whole atom).
 */
function answersIsConnected(
  connection: IAbapConnection,
): connection is IAbapConnection & Pick<ISessionLifecycleAware, 'isConnected'> {
  return (
    'isConnected' in connection && typeof connection.isConnected === 'function'
  );
}

export class AdtClient<V extends AdtVariant = AdtModernVariant> {
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
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
    // Wrapped once, here, where a connection enters the library. The wrapper
    // puts the request back on the answer and reads nothing: what a body means
    // is the caller's, through the `analyse` they pass.
    this.connection = withRequestTrace(connection);
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
   * on `ISessionLifecycleAware`, not on `IAbapConnection`: a connection without
   * the method cannot answer, and it must not be blocked on its silence. (The
   * connectors of `@mcp-abap-adt/connection`, the RFC one included, do declare
   * it, so for them the check bites.) This is a real limit, not an oversight — a
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
   *
   * Protected, not private, so that a subclass's getters in another package
   * (`AdtClientLegacy` of `@mcp-abap-adt/adt-clients-legacy`) — which replace
   * the base's and so skip its call — run the same check first.
   */
  protected assertConnected(): void {
    const connection = this.connection;
    if (!answersIsConnected(connection)) return;

    if (!connection.isConnected()) {
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
  // Two overloads, like every getter here: no argument answers the class typed
  // by the shipped set; a result set answers one typed by it. A caller naming
  // its own R passes its results — no default is typed as R.
  getClass(
    this: this & AdtServedBy<'class'>,
  ): AdtClass<ResultValuesOf<typeof classDocuments>, V>;
  getClass<R extends IClassResults>(
    this: this & AdtServedBy<'class'>,
    results: R,
  ): AdtClass<ResultValuesOf<R>, V>;
  getClass(
    this: this & AdtServedBy<'class'>,
    results: IClassResults = classDocuments,
  ): AdtClass<ClassValues, V> {
    this.assertConnected();
    return new AdtClass<ClassValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for Program objects
   * @returns IAdtObject instance for Program operations
   */
  getProgram(
    this: this & AdtServedBy<'program'>,
  ): AdtProgram<ResultValuesOf<typeof programDocuments>, V>;
  getProgram<R extends IProgramResults>(
    this: this & AdtServedBy<'program'>,
    results: R,
  ): AdtProgram<ResultValuesOf<R>, V>;
  getProgram(
    this: this & AdtServedBy<'program'>,
    results: IProgramResults = programDocuments,
  ): AdtProgram<ProgramValues, V> {
    this.assertConnected();
    return new AdtProgram<ProgramValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
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
  getInclude(
    this: this & AdtServedBy<'include'>,
  ): AdtInclude<ResultValuesOf<typeof includeDocuments>, V>;
  getInclude<R extends IIncludeResults>(
    this: this & AdtServedBy<'include'>,
    results: R,
  ): AdtInclude<ResultValuesOf<R>, V>;
  getInclude(
    this: this & AdtServedBy<'include'>,
    results: IIncludeResults = includeDocuments,
  ): AdtInclude<IncludeValues, V> {
    this.assertConnected();
    return new AdtInclude<IncludeValues, V>(this.connection, {
      logger: this.logger,
      contentTypes: this.contentTypes,
      results,
      systemContext: this.systemContext,
    });
  }

  /**
   * Get high-level operations for Interface objects
   * @returns IAdtObject instance for Interface operations
   */
  getInterface(
    this: this & AdtServedBy<'interface'>,
  ): AdtInterface<ResultValuesOf<typeof interfaceDocuments>, V>;
  getInterface<R extends IInterfaceResults>(
    this: this & AdtServedBy<'interface'>,
    results: R,
  ): AdtInterface<ResultValuesOf<R>, V>;
  getInterface(
    this: this & AdtServedBy<'interface'>,
    results: IInterfaceResults = interfaceDocuments,
  ): AdtInterface<InterfaceValues, V> {
    this.assertConnected();
    return new AdtInterface<InterfaceValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for Domain objects
   * @returns IAdtObject instance for Domain operations
   */
  getDomain(
    this: this & AdtServedBy<'domain'>,
  ): AdtDomain<ResultValuesOf<typeof domainDocuments>>;
  getDomain<R extends IDomainResults>(
    this: this & AdtServedBy<'domain'>,
    results: R,
  ): AdtDomain<ResultValuesOf<R>>;
  getDomain(
    this: this & AdtServedBy<'domain'>,
    results: IDomainResults = domainDocuments,
  ): AdtDomain<DomainValues> {
    this.assertConnected();
    return new AdtDomain<DomainValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Last-resort cleanup: release every lock still held by handlers created from
   * this client. Returns the locks that could not be released.
   *
   * This is a safety net for abandoned locks (a forgot-to-unlock, or a managed
   * flow that threw before its unlock). Preventing a timeout from interrupting a
   * lock→unlock critical section remains the caller's responsibility.
   *
   * Rejects with the connection's credential refusal, the same object, when
   * the provider refused before SAP was asked: the remaining locks stay in
   * {@link pendingLocks}, untried.
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
   * Best-effort: like {@link unlockAll}, this throws for nothing SAP answered —
   * a lock whose unlock fails is retained rather than surfaced as an error, so
   * a disposer failure cannot mask the error that ended the `using` scope. The
   * one exception is the credential refusal {@link unlockAll} rejects with: it
   * is the caller's signal to stop and propagates as the same object (under
   * `await using`, a scope that also threw sees the language's
   * `SuppressedError` holding both). Any residual failures
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
  getDataElement(
    this: this & AdtServedBy<'dataElement'>,
  ): AdtDataElement<ResultValuesOf<typeof dataElementDocuments>>;
  getDataElement<R extends IDataElementResults>(
    this: this & AdtServedBy<'dataElement'>,
    results: R,
  ): AdtDataElement<ResultValuesOf<R>>;
  getDataElement(
    this: this & AdtServedBy<'dataElement'>,
    results: IDataElementResults = dataElementDocuments,
  ): AdtDataElement<DataElementValues> {
    this.assertConnected();
    return new AdtDataElement<DataElementValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for AuthorizationField objects
   * @returns IAdtObject instance for AuthorizationField operations
   */
  getAuthorizationField(
    this: this & AdtServedBy<'authorizationField'>,
  ): AdtAuthorizationField<ResultValuesOf<typeof authorizationFieldDocuments>>;
  getAuthorizationField<R extends IAuthorizationFieldResults>(
    this: this & AdtServedBy<'authorizationField'>,
    results: R,
  ): AdtAuthorizationField<ResultValuesOf<R>>;
  getAuthorizationField(
    this: this & AdtServedBy<'authorizationField'>,
    results: IAuthorizationFieldResults = authorizationFieldDocuments,
  ): AdtAuthorizationField<AuthorizationFieldValues> {
    this.assertConnected();
    return new AdtAuthorizationField<AuthorizationFieldValues>(
      this.connection,
      {
        logger: this.logger,
        systemContext: this.systemContext,
        lockRegistry: this.lockRegistry,
        results,
      },
    );
  }

  /**
   * Get high-level operations for Structure objects
   * @returns IAdtObject instance for Structure operations
   */
  getStructure(
    this: this & AdtServedBy<'structure'>,
  ): AdtStructure<ResultValuesOf<typeof structureDocuments>, V>;
  getStructure<R extends IStructureResults>(
    this: this & AdtServedBy<'structure'>,
    results: R,
  ): AdtStructure<ResultValuesOf<R>, V>;
  getStructure(
    this: this & AdtServedBy<'structure'>,
    results: IStructureResults = structureDocuments,
  ): AdtStructure<StructureValues, V> {
    this.assertConnected();
    return new AdtStructure<StructureValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for Table objects
   * @returns IAdtObject instance for Table operations
   */
  getTable(
    this: this & AdtServedBy<'table'>,
  ): AdtTable<ResultValuesOf<typeof tableDocuments>, V>;
  getTable<R extends ITableResults>(
    this: this & AdtServedBy<'table'>,
    results: R,
  ): AdtTable<ResultValuesOf<R>, V>;
  getTable(
    this: this & AdtServedBy<'table'>,
    results: ITableResults = tableDocuments,
  ): AdtTable<TableValues, V> {
    this.assertConnected();
    return new AdtTable<TableValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for TableType (DDIC Table Type) objects
   * @returns IAdtObject instance for TableType operations
   */
  getTableType(
    this: this & AdtServedBy<'tableType'>,
  ): AdtDdicTableType<ResultValuesOf<typeof tableTypeDocuments>>;
  getTableType<R extends ITableTypeResults>(
    this: this & AdtServedBy<'tableType'>,
    results: R,
  ): AdtDdicTableType<ResultValuesOf<R>>;
  getTableType(
    this: this & AdtServedBy<'tableType'>,
    results: ITableTypeResults = tableTypeDocuments,
  ): AdtDdicTableType<TableTypeValues> {
    this.assertConnected();
    return new AdtDdicTableType<TableTypeValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Generic client for ABAP DDL source objects (`/sap/bc/adt/ddic/ddl/sources/`):
   * CDS views, AMDP table functions, and other DDL sources. Classic DDIC structures
   * (`/ddic/structures/`), tables (`/ddic/tables/`), and scalar functions
   * (`/ddic/dsfd/sources/`) have their own clients.
   * @returns IAdtObject instance for DDL source operations
   */
  getDdl(
    this: this & AdtServedBy<'ddl'>,
  ): AdtDdl<ResultValuesOf<typeof ddlDocuments>, V>;
  getDdl<R extends IDdlResults>(
    this: this & AdtServedBy<'ddl'>,
    results: R,
  ): AdtDdl<ResultValuesOf<R>, V>;
  getDdl(
    this: this & AdtServedBy<'ddl'>,
    results: IDdlResults = ddlDocuments,
  ): AdtDdl<DdlValues, V> {
    this.assertConnected();
    return new AdtDdl<DdlValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for FunctionGroup objects
   * @returns IAdtObject instance for FunctionGroup operations
   */
  getFunctionGroup(
    this: this & AdtServedBy<'functionGroup'>,
  ): AdtFunctionGroup<ResultValuesOf<typeof functionGroupDocuments>, V>;
  getFunctionGroup<R extends IFunctionGroupResults>(
    this: this & AdtServedBy<'functionGroup'>,
    results: R,
  ): AdtFunctionGroup<ResultValuesOf<R>, V>;
  getFunctionGroup(
    this: this & AdtServedBy<'functionGroup'>,
    results: IFunctionGroupResults = functionGroupDocuments,
  ): AdtFunctionGroup<FunctionGroupValues, V> {
    this.assertConnected();
    return new AdtFunctionGroup<FunctionGroupValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for FunctionModule objects
   * @returns IAdtObject instance for FunctionModule operations
   */
  getFunctionModule(
    this: this & AdtServedBy<'functionModule'>,
  ): AdtFunctionModule<ResultValuesOf<typeof functionModuleDocuments>, V>;
  getFunctionModule<R extends IFunctionModuleResults>(
    this: this & AdtServedBy<'functionModule'>,
    results: R,
  ): AdtFunctionModule<ResultValuesOf<R>, V>;
  getFunctionModule(
    this: this & AdtServedBy<'functionModule'>,
    results: IFunctionModuleResults = functionModuleDocuments,
  ): AdtFunctionModule<FunctionModuleValues, V> {
    this.assertConnected();
    return new AdtFunctionModule<FunctionModuleValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for FunctionInclude objects
   * @returns IAdtObject instance for FunctionInclude operations
   */
  getFunctionInclude(
    this: this & AdtServedBy<'functionInclude'>,
  ): AdtFunctionInclude<ResultValuesOf<typeof functionIncludeDocuments>, V>;
  getFunctionInclude<R extends IFunctionIncludeResults>(
    this: this & AdtServedBy<'functionInclude'>,
    results: R,
  ): AdtFunctionInclude<ResultValuesOf<R>, V>;
  getFunctionInclude(
    this: this & AdtServedBy<'functionInclude'>,
    results: IFunctionIncludeResults = functionIncludeDocuments,
  ): AdtFunctionInclude<FunctionIncludeValues, V> {
    this.assertConnected();
    return new AdtFunctionInclude<FunctionIncludeValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for Package objects
   * @returns IAdtObject instance for Package operations
   */
  getPackage(
    this: this & AdtServedBy<'package'>,
  ): AdtPackage<ResultValuesOf<typeof packageDocuments>>;
  getPackage<R extends IPackageResults>(
    this: this & AdtServedBy<'package'>,
    results: R,
  ): AdtPackage<ResultValuesOf<R>>;
  getPackage(
    this: this & AdtServedBy<'package'>,
    results: IPackageResults = packageDocuments,
  ): AdtPackage<PackageValues> {
    this.assertConnected();
    return new AdtPackage<PackageValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for MessageClass (MSAG/N) objects
   * @returns IAdtObject instance for MessageClass operations
   */
  getMessageClass(
    this: this & AdtServedBy<'messageClass'>,
  ): AdtMessageClass<ResultValuesOf<typeof messageClassDocuments>, V>;
  getMessageClass<R extends IMessageClassResults>(
    this: this & AdtServedBy<'messageClass'>,
    results: R,
  ): AdtMessageClass<ResultValuesOf<R>, V>;
  getMessageClass(
    this: this & AdtServedBy<'messageClass'>,
    results: IMessageClassResults = messageClassDocuments,
  ): AdtMessageClass<MessageClassValues, V> {
    this.assertConnected();
    return new AdtMessageClass<MessageClassValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for a single message within a MessageClass.
   *
   * A message class (MSAG) is not an ABAP class, whatever the name suggests,
   * and a message inside one is an entity that is genuinely created: it does
   * not exist until someone adds it. So this keeps `create` — unlike a class's
   * includes, which exist because their class does.
   */
  getMessageClassMessage(
    this: this & AdtServedBy<'messageClassMessage'>,
  ): AdtMessageClassMessage<ResultValuesOf<typeof messageDocuments>>;
  getMessageClassMessage<R extends IMessageClassMessageResults>(
    this: this & AdtServedBy<'messageClassMessage'>,
    results: R,
  ): AdtMessageClassMessage<ResultValuesOf<R>>;
  getMessageClassMessage(
    this: this & AdtServedBy<'messageClassMessage'>,
    results: IMessageClassMessageResults = messageDocuments,
  ): AdtMessageClassMessage<MessageClassMessageValues> {
    this.assertConnected();
    return new AdtMessageClassMessage<MessageClassMessageValues>(
      this.connection,
      { logger: this.logger, results },
    );
  }

  /**
   * Get high-level operations for AccessControl objects
   * @returns IAdtObject instance for AccessControl operations
   */
  getAccessControl(
    this: this & AdtServedBy<'accessControl'>,
  ): AdtAccessControl<ResultValuesOf<typeof accessControlDocuments>, V>;
  getAccessControl<R extends IAccessControlResults>(
    this: this & AdtServedBy<'accessControl'>,
    results: R,
  ): AdtAccessControl<ResultValuesOf<R>, V>;
  getAccessControl(
    this: this & AdtServedBy<'accessControl'>,
    results: IAccessControlResults = accessControlDocuments,
  ): AdtAccessControl<AccessControlValues, V> {
    this.assertConnected();
    return new AdtAccessControl<AccessControlValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for Transformation objects (XSLT)
   * Supports both SimpleTransformation and XSLTProgram types
   * @returns IAdtObject instance for Transformation operations
   */
  getTransformation(
    this: this & AdtServedBy<'transformation'>,
  ): AdtTransformation<ResultValuesOf<typeof transformationDocuments>, V>;
  getTransformation<R extends ITransformationResults>(
    this: this & AdtServedBy<'transformation'>,
    results: R,
  ): AdtTransformation<ResultValuesOf<R>, V>;
  getTransformation(
    this: this & AdtServedBy<'transformation'>,
    results: ITransformationResults = transformationDocuments,
  ): AdtTransformation<TransformationValues, V> {
    this.assertConnected();
    return new AdtTransformation<TransformationValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for ServiceDefinition objects
   * @returns IAdtObject instance for ServiceDefinition operations
   */
  getServiceDefinition(
    this: this & AdtServedBy<'serviceDefinition'>,
  ): AdtServiceDefinition<ResultValuesOf<typeof serviceDefinitionDocuments>, V>;
  getServiceDefinition<R extends IServiceDefinitionResults>(
    this: this & AdtServedBy<'serviceDefinition'>,
    results: R,
  ): AdtServiceDefinition<ResultValuesOf<R>, V>;
  getServiceDefinition(
    this: this & AdtServedBy<'serviceDefinition'>,
    results: IServiceDefinitionResults = serviceDefinitionDocuments,
  ): AdtServiceDefinition<ServiceDefinitionValues, V> {
    this.assertConnected();
    return new AdtServiceDefinition<ServiceDefinitionValues, V>(
      this.connection,
      {
        logger: this.logger,
        systemContext: this.systemContext,
        lockRegistry: this.lockRegistry,
        results,
      },
    );
  }

  /**
   * Get high-level operations for CDS Scalar Function (DSFD/SCF) objects
   */
  getScalarFunction(
    this: this & AdtServedBy<'scalarFunction'>,
  ): AdtScalarFunction<ResultValuesOf<typeof scalarFunctionDocuments>, V>;
  getScalarFunction<R extends IScalarFunctionResults>(
    this: this & AdtServedBy<'scalarFunction'>,
    results: R,
  ): AdtScalarFunction<ResultValuesOf<R>, V>;
  getScalarFunction(
    this: this & AdtServedBy<'scalarFunction'>,
    results: IScalarFunctionResults = scalarFunctionDocuments,
  ): AdtScalarFunction<ScalarFunctionValues, V> {
    this.assertConnected();
    return new AdtScalarFunction<ScalarFunctionValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for Scalar Function Implementation (DSFI/SFI) objects
   */
  getScalarFunctionImplementation(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
  ): AdtScalarFunctionImplementation<
    ResultValuesOf<typeof scalarFunctionImplementationDocuments>
  >;
  getScalarFunctionImplementation<
    R extends IScalarFunctionImplementationResults,
  >(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
    results: R,
  ): AdtScalarFunctionImplementation<ResultValuesOf<R>>;
  getScalarFunctionImplementation(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
    results: IScalarFunctionImplementationResults = scalarFunctionImplementationDocuments,
  ): AdtScalarFunctionImplementation<ScalarFunctionImplementationValues> {
    this.assertConnected();
    return new AdtScalarFunctionImplementation<ScalarFunctionImplementationValues>(
      this.connection,
      {
        logger: this.logger,
        systemContext: this.systemContext,
        lockRegistry: this.lockRegistry,
        results,
      },
    );
  }

  /**
   * Get high-level operations for Append Structure (TABL/DS) objects
   */
  getAppendStructure(
    this: this & AdtServedBy<'appendStructure'>,
  ): AdtAppendStructure<ResultValuesOf<typeof appendStructureDocuments>>;
  getAppendStructure<R extends IAppendStructureResults>(
    this: this & AdtServedBy<'appendStructure'>,
    results: R,
  ): AdtAppendStructure<ResultValuesOf<R>>;
  getAppendStructure(
    this: this & AdtServedBy<'appendStructure'>,
    results: IAppendStructureResults = appendStructureDocuments,
  ): AdtAppendStructure<AppendStructureValues> {
    this.assertConnected();
    return new AdtAppendStructure<AppendStructureValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for ServiceBinding objects
   * @returns a ServiceBinding handler — CRUD and lifecycle, as the atoms
   */
  getServiceBinding(
    this: this & AdtServedBy<'serviceBinding'>,
  ): AdtServiceBinding<ResultValuesOf<typeof serviceDocuments>, V>;
  getServiceBinding<R extends IServiceResults>(
    this: this & AdtServedBy<'serviceBinding'>,
    results: R,
  ): AdtServiceBinding<ResultValuesOf<R>, V>;
  getServiceBinding(
    this: this & AdtServedBy<'serviceBinding'>,
    results: IServiceResults = serviceDocuments,
  ): AdtServiceBinding<ServiceValues, V> {
    this.assertConnected();
    return new AdtServiceBinding<ServiceValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      results,
    });
  }

  /**
   * Get high-level operations for BehaviorDefinition objects
   * @returns IAdtObject instance for BehaviorDefinition operations
   */
  getBehaviorDefinition(
    this: this & AdtServedBy<'behaviorDefinition'>,
  ): AdtBehaviorDefinition<
    ResultValuesOf<typeof behaviorDefinitionDocuments>,
    V
  >;
  getBehaviorDefinition<R extends IBehaviorDefinitionResults>(
    this: this & AdtServedBy<'behaviorDefinition'>,
    results: R,
  ): AdtBehaviorDefinition<ResultValuesOf<R>, V>;
  getBehaviorDefinition(
    this: this & AdtServedBy<'behaviorDefinition'>,
    results: IBehaviorDefinitionResults = behaviorDefinitionDocuments,
  ): AdtBehaviorDefinition<BehaviorDefinitionValues, V> {
    this.assertConnected();
    return new AdtBehaviorDefinition<BehaviorDefinitionValues, V>(
      this.connection,
      {
        logger: this.logger,
        systemContext: this.systemContext,
        lockRegistry: this.lockRegistry,
        results,
      },
    );
  }

  /**
   * Get high-level operations for BehaviorImplementation objects
   * @returns IAdtObject instance for BehaviorImplementation operations
   */
  getBehaviorImplementation(
    this: this & AdtServedBy<'behaviorImplementation'>,
  ): AdtBehaviorImplementation<ResultValuesOf<typeof classDocuments>>;
  getBehaviorImplementation<R extends IClassResults>(
    this: this & AdtServedBy<'behaviorImplementation'>,
    results: R,
  ): AdtBehaviorImplementation<ResultValuesOf<R>>;
  getBehaviorImplementation(
    this: this & AdtServedBy<'behaviorImplementation'>,
    results: IClassResults = classDocuments,
  ): AdtBehaviorImplementation<ClassValues> {
    this.assertConnected();
    return new AdtBehaviorImplementation<ClassValues>(this.connection, {
      logger: this.logger,
      lockRegistry: this.lockRegistry,
      results,
      systemContext: this.systemContext,
    });
  }

  /**
   * Get high-level operations for MetadataExtension objects
   * @returns IAdtObject instance for MetadataExtension operations
   */
  getMetadataExtension(
    this: this & AdtServedBy<'metadataExtension'>,
  ): AdtMetadataExtension<ResultValuesOf<typeof metadataExtensionDocuments>, V>;
  getMetadataExtension<R extends IMetadataExtensionResults>(
    this: this & AdtServedBy<'metadataExtension'>,
    results: R,
  ): AdtMetadataExtension<ResultValuesOf<R>, V>;
  getMetadataExtension(
    this: this & AdtServedBy<'metadataExtension'>,
    results: IMetadataExtensionResults = metadataExtensionDocuments,
  ): AdtMetadataExtension<MetadataExtensionValues, V> {
    this.assertConnected();
    return new AdtMetadataExtension<MetadataExtensionValues, V>(
      this.connection,
      {
        logger: this.logger,
        systemContext: this.systemContext,
        lockRegistry: this.lockRegistry,
        results,
      },
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
  getEnhancement(
    this: this & AdtServedBy<'enhancement'>,
  ): AdtEnhancement<ResultValuesOf<typeof enhancementDocuments>, V>;
  getEnhancement<R extends IEnhancementResults>(
    this: this & AdtServedBy<'enhancement'>,
    results: R,
  ): AdtEnhancement<ResultValuesOf<R>, V>;
  getEnhancement(
    this: this & AdtServedBy<'enhancement'>,
    results: IEnhancementResults = enhancementDocuments,
  ): AdtEnhancement<EnhancementValues, V> {
    this.assertConnected();
    return new AdtEnhancement<EnhancementValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for FeatureToggle objects
   * @returns IFeatureToggleObject instance for FeatureToggle operations
   */
  getFeatureToggle(
    this: this & AdtServedBy<'featureToggle'>,
  ): AdtFeatureToggle<ResultValuesOf<typeof featureToggleDocuments>>;
  getFeatureToggle<R extends IFeatureToggleResults>(
    this: this & AdtServedBy<'featureToggle'>,
    results: R,
  ): AdtFeatureToggle<ResultValuesOf<R>>;
  getFeatureToggle(
    this: this & AdtServedBy<'featureToggle'>,
    results: IFeatureToggleResults = featureToggleDocuments,
  ): AdtFeatureToggle<FeatureToggleValues> {
    this.assertConnected();
    return new AdtFeatureToggle<FeatureToggleValues>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      lockRegistry: this.lockRegistry,
      results,
    });
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
  getRequest(
    this: this & AdtServedBy<'request'>,
  ): AdtRequest<ResultValuesOf<typeof transportDocuments>, V>;
  getRequest<R extends ITransportResults>(
    this: this & AdtServedBy<'request'>,
    results: R,
  ): AdtRequest<ResultValuesOf<R>, V>;
  getRequest(
    this: this & AdtServedBy<'request'>,
    results: ITransportResults = transportDocuments,
  ): AdtRequest<TransportValues, V> {
    this.assertConnected();
    return new AdtRequest<TransportValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      results,
    });
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
   * Answers the class, `AdtUtils`. A consumer types what it holds by its own
   * contract, composed from the atoms of `@mcp-abap-adt/interfaces-adt` it
   * calls (`IAdtInformationSystem`, `IAdtObjectAccess`, …); the compiler checks,
   * where the consumer takes the client, that the class satisfies it.
   *
   * Every public member of `AdtUtils` belongs to one of seven atoms
   * (`IAdtInformationSystem`, `IAdtRepositoryStructure`, `IAdtGroupLifecycle`,
   * `IAdtDataPreview`, `IAdtDiscovery`, `IAdtObjectAccess`,
   * `IAdtObjectProperties`); `capabilities/shape.ts` holds the class to that.
   *
   * The sentence that stood here — "a caller who needs the raw document passes a
   * parser to the sibling" — described an API that no longer exists: the parser
   * overloads went in 30.0.0, when the reading became something injected once
   * rather than passed per call. There is no way to ask these members for
   * another shape today, and saying otherwise was worse than saying nothing.
   *
   * @returns The cross-cutting operations, `AdtUtils`
   */
  getUtils(): AdtUtils<ResultValuesOf<typeof utilDocuments>, V>;
  getUtils<R extends IUtilResults>(results: R): AdtUtils<ResultValuesOf<R>, V>;
  getUtils(results: IUtilResults = utilDocuments): AdtUtils<UtilValues, V> {
    this.assertConnected();
    return new AdtUtils<UtilValues, V>(this.connection, {
      logger: this.logger,
      results,
    });
  }

  /**
   * Get high-level operations for a class's `testclasses` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  getLocalTestClass(
    this: this & AdtServedBy<'localTestClass'>,
  ): AdtLocalTestClass<ResultValuesOf<typeof classDocuments>, V>;
  getLocalTestClass<R extends IClassResults>(
    this: this & AdtServedBy<'localTestClass'>,
    results: R,
  ): AdtLocalTestClass<ResultValuesOf<R>, V>;
  getLocalTestClass(
    this: this & AdtServedBy<'localTestClass'>,
    results: IClassResults = classDocuments,
  ): AdtLocalTestClass<ClassValues, V> {
    this.assertConnected();
    return new AdtLocalTestClass<ClassValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for a class's `localtypes` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  getLocalTypes(
    this: this & AdtServedBy<'localTypes'>,
  ): AdtLocalTypes<ResultValuesOf<typeof classDocuments>, V>;
  getLocalTypes<R extends IClassResults>(
    this: this & AdtServedBy<'localTypes'>,
    results: R,
  ): AdtLocalTypes<ResultValuesOf<R>, V>;
  getLocalTypes(
    this: this & AdtServedBy<'localTypes'>,
    results: IClassResults = classDocuments,
  ): AdtLocalTypes<ClassValues, V> {
    this.assertConnected();
    return new AdtLocalTypes<ClassValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for a class's `definitions` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  getLocalDefinitions(
    this: this & AdtServedBy<'localDefinitions'>,
  ): AdtLocalDefinitions<ResultValuesOf<typeof classDocuments>, V>;
  getLocalDefinitions<R extends IClassResults>(
    this: this & AdtServedBy<'localDefinitions'>,
    results: R,
  ): AdtLocalDefinitions<ResultValuesOf<R>, V>;
  getLocalDefinitions(
    this: this & AdtServedBy<'localDefinitions'>,
    results: IClassResults = classDocuments,
  ): AdtLocalDefinitions<ClassValues, V> {
    this.assertConnected();
    return new AdtLocalDefinitions<ClassValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }

  /**
   * Get high-level operations for a class's `macros` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  getLocalMacros(
    this: this & AdtServedBy<'localMacros'>,
  ): AdtLocalMacros<ResultValuesOf<typeof classDocuments>, V>;
  getLocalMacros<R extends IClassResults>(
    this: this & AdtServedBy<'localMacros'>,
    results: R,
  ): AdtLocalMacros<ResultValuesOf<R>, V>;
  getLocalMacros(
    this: this & AdtServedBy<'localMacros'>,
    results: IClassResults = classDocuments,
  ): AdtLocalMacros<ClassValues, V> {
    this.assertConnected();
    return new AdtLocalMacros<ClassValues, V>(this.connection, {
      logger: this.logger,
      systemContext: this.systemContext,
      contentTypes: this.contentTypes,
      lockRegistry: this.lockRegistry,
      results,
    });
  }
}
