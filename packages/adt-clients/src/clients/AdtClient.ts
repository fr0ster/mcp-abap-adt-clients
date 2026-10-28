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
 * Each factory answers its own handler class (`AdtClass<R>`, …) over the
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
  AdtAccessControl,
  accessControlDocuments,
} from '../core/accessControl';
import {
  AdtAppendStructure,
  appendStructureDocuments,
} from '../core/appendStructure';
import {
  AdtAuthorizationField,
  authorizationFieldDocuments,
} from '../core/authorizationField';
import {
  AdtBehaviorDefinition,
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
} from '../core/class';
import { AdtDataElement, dataElementDocuments } from '../core/dataElement';
import { AdtDdl, ddlDocuments } from '../core/ddl';
import { AdtDomain, domainDocuments } from '../core/domain';
import { AdtEnhancement, enhancementDocuments } from '../core/enhancement';
import {
  AdtFeatureToggle,
  featureToggleDocuments,
} from '../core/featureToggle';
import {
  AdtFunctionGroup,
  functionGroupDocuments,
} from '../core/functionGroup';
import {
  AdtFunctionInclude,
  functionIncludeDocuments,
} from '../core/functionInclude';
import {
  AdtFunctionModule,
  functionModuleDocuments,
} from '../core/functionModule';
import { AdtInclude, includeDocuments } from '../core/include';
import { AdtInterface, interfaceDocuments } from '../core/interface';
import {
  AdtMessageClass,
  AdtMessageClassMessage,
  messageClassDocuments,
  messageDocuments,
} from '../core/messageClass';
import {
  AdtMetadataExtension,
  metadataExtensionDocuments,
} from '../core/metadataExtension';
import { AdtPackage, packageDocuments } from '../core/package';
import { AdtProgram, programDocuments } from '../core/program';
import {
  AdtScalarFunction,
  scalarFunctionDocuments,
} from '../core/scalarFunction';
import {
  AdtScalarFunctionImplementation,
  scalarFunctionImplementationDocuments,
} from '../core/scalarFunctionImplementation';
import { AdtServiceBinding, serviceDocuments } from '../core/service';
import {
  AdtServiceDefinition,
  serviceDefinitionDocuments,
} from '../core/serviceDefinition';
import { AdtUtils } from '../core/shared/AdtUtils';
import { type LockFailure, LockRegistry } from '../core/shared/LockRegistry';
import { utilDocuments } from '../core/shared/utilResultSet';
import { AdtStructure, structureDocuments } from '../core/structure';
import { AdtTable, tableDocuments } from '../core/table';
import { AdtDdicTableType, tableTypeDocuments } from '../core/tabletype';
import {
  AdtTransformation,
  transformationDocuments,
} from '../core/transformation';
import { AdtRequest, transportDocuments } from '../core/transport';
import { withRequestTrace } from '../utils/requestTrace';
import type { AdtModernVariant, AdtServedBy } from './variant';

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
  // Generic in R, defaulting to the shipped set: erasing R here would build the
  // object at `unknown` while the members answer `ReturnType<R['source']>`.
  getClass<R extends IClassResults = typeof classDocuments>(
    this: this & AdtServedBy<'class'>,
    results: R = classDocuments as unknown as R,
  ): AdtClass<R, V> {
    this.assertConnected();
    return new AdtClass<R, V>(
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
  getProgram<R extends IProgramResults = typeof programDocuments>(
    this: this & AdtServedBy<'program'>,
    results: R = programDocuments as unknown as R,
  ): AdtProgram<R, V> {
    this.assertConnected();
    return new AdtProgram<R, V>(
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
  getInclude<R extends IIncludeResults = typeof includeDocuments>(
    this: this & AdtServedBy<'include'>,
    results: R = includeDocuments as unknown as R,
  ): AdtInclude<R, V> {
    this.assertConnected();
    return new AdtInclude<R, V>(
      this.connection,
      this.logger,
      this.contentTypes,
      results,
      this.systemContext,
    );
  }

  /**
   * Get high-level operations for Interface objects
   * @returns IAdtObject instance for Interface operations
   */
  getInterface<R extends IInterfaceResults = typeof interfaceDocuments>(
    this: this & AdtServedBy<'interface'>,
    results: R = interfaceDocuments as unknown as R,
  ): AdtInterface<R, V> {
    this.assertConnected();
    return new AdtInterface<R, V>(
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
  getDomain<R extends IDomainResults = typeof domainDocuments>(
    this: this & AdtServedBy<'domain'>,
    results: R = domainDocuments as unknown as R,
  ): AdtDomain<R> {
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
  getDataElement<R extends IDataElementResults = typeof dataElementDocuments>(
    this: this & AdtServedBy<'dataElement'>,
    results: R = dataElementDocuments as unknown as R,
  ): AdtDataElement<R> {
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
  getAuthorizationField<
    R extends IAuthorizationFieldResults = typeof authorizationFieldDocuments,
  >(
    this: this & AdtServedBy<'authorizationField'>,
    results: R = authorizationFieldDocuments as unknown as R,
  ): AdtAuthorizationField<R> {
    this.assertConnected();
    return new AdtAuthorizationField<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Structure objects
   * @returns IAdtObject instance for Structure operations
   */
  getStructure<R extends IStructureResults = typeof structureDocuments>(
    this: this & AdtServedBy<'structure'>,
    results: R = structureDocuments as unknown as R,
  ): AdtStructure<R, V> {
    this.assertConnected();
    return new AdtStructure<R, V>(
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
  getTable<R extends ITableResults = typeof tableDocuments>(
    this: this & AdtServedBy<'table'>,
    results: R = tableDocuments as unknown as R,
  ): AdtTable<R, V> {
    this.assertConnected();
    return new AdtTable<R, V>(
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
  getTableType<R extends ITableTypeResults = typeof tableTypeDocuments>(
    this: this & AdtServedBy<'tableType'>,
    results: R = tableTypeDocuments as unknown as R,
  ): AdtDdicTableType<R> {
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
  getDdl<R extends IDdlResults = typeof ddlDocuments>(
    this: this & AdtServedBy<'ddl'>,
    results: R = ddlDocuments as unknown as R,
  ): AdtDdl<R, V> {
    this.assertConnected();
    return new AdtDdl<R, V>(
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
  getFunctionGroup<
    R extends IFunctionGroupResults = typeof functionGroupDocuments,
  >(
    this: this & AdtServedBy<'functionGroup'>,
    results: R = functionGroupDocuments as unknown as R,
  ): AdtFunctionGroup<R, V> {
    this.assertConnected();
    return new AdtFunctionGroup<R, V>(
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
  getFunctionModule<
    R extends IFunctionModuleResults = typeof functionModuleDocuments,
  >(
    this: this & AdtServedBy<'functionModule'>,
    results: R = functionModuleDocuments as unknown as R,
  ): AdtFunctionModule<R, V> {
    this.assertConnected();
    return new AdtFunctionModule<R, V>(
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
  getFunctionInclude<
    R extends IFunctionIncludeResults = typeof functionIncludeDocuments,
  >(
    this: this & AdtServedBy<'functionInclude'>,
    results: R = functionIncludeDocuments as unknown as R,
  ): AdtFunctionInclude<R, V> {
    this.assertConnected();
    return new AdtFunctionInclude<R, V>(
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
  getPackage<R extends IPackageResults = typeof packageDocuments>(
    this: this & AdtServedBy<'package'>,
    results: R = packageDocuments as unknown as R,
  ): AdtPackage<R> {
    this.assertConnected();
    return new AdtPackage<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for MessageClass (MSAG/N) objects
   * @returns IAdtObject instance for MessageClass operations
   */
  getMessageClass<
    R extends IMessageClassResults = typeof messageClassDocuments,
  >(
    this: this & AdtServedBy<'messageClass'>,
    results: R = messageClassDocuments as unknown as R,
  ): AdtMessageClass<R, V> {
    this.assertConnected();
    return new AdtMessageClass<R, V>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
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
  getMessageClassMessage<
    R extends IMessageClassMessageResults = typeof messageDocuments,
  >(
    this: this & AdtServedBy<'messageClassMessage'>,
    results: R = messageDocuments as unknown as R,
  ): AdtMessageClassMessage<R> {
    this.assertConnected();
    return new AdtMessageClassMessage<R>(this.connection, this.logger, results);
  }

  /**
   * Get high-level operations for AccessControl objects
   * @returns IAdtObject instance for AccessControl operations
   */
  getAccessControl<
    R extends IAccessControlResults = typeof accessControlDocuments,
  >(
    this: this & AdtServedBy<'accessControl'>,
    results: R = accessControlDocuments as unknown as R,
  ): AdtAccessControl<R, V> {
    this.assertConnected();
    return new AdtAccessControl<R, V>(
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
  getTransformation<
    R extends ITransformationResults = typeof transformationDocuments,
  >(
    this: this & AdtServedBy<'transformation'>,
    results: R = transformationDocuments as unknown as R,
  ): AdtTransformation<R, V> {
    this.assertConnected();
    return new AdtTransformation<R, V>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for ServiceDefinition objects
   * @returns IAdtObject instance for ServiceDefinition operations
   */
  getServiceDefinition<
    R extends IServiceDefinitionResults = typeof serviceDefinitionDocuments,
  >(
    this: this & AdtServedBy<'serviceDefinition'>,
    results: R = serviceDefinitionDocuments as unknown as R,
  ): AdtServiceDefinition<R, V> {
    this.assertConnected();
    return new AdtServiceDefinition<R, V>(
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
  getScalarFunction<
    R extends IScalarFunctionResults = typeof scalarFunctionDocuments,
  >(
    this: this & AdtServedBy<'scalarFunction'>,
    results: R = scalarFunctionDocuments as unknown as R,
  ): AdtScalarFunction<R, V> {
    this.assertConnected();
    return new AdtScalarFunction<R, V>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Scalar Function Implementation (DSFI/SFI) objects
   */
  getScalarFunctionImplementation<
    R extends
      IScalarFunctionImplementationResults = typeof scalarFunctionImplementationDocuments,
  >(
    this: this & AdtServedBy<'scalarFunctionImplementation'>,
    results: R = scalarFunctionImplementationDocuments as unknown as R,
  ): AdtScalarFunctionImplementation<R> {
    this.assertConnected();
    return new AdtScalarFunctionImplementation<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for Append Structure (TABL/DS) objects
   */
  getAppendStructure<
    R extends IAppendStructureResults = typeof appendStructureDocuments,
  >(
    this: this & AdtServedBy<'appendStructure'>,
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
   * @returns a ServiceBinding handler — CRUD and lifecycle, as the atoms
   */
  getServiceBinding<R extends IServiceResults = typeof serviceDocuments>(
    this: this & AdtServedBy<'serviceBinding'>,
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
   * Get high-level operations for BehaviorDefinition objects
   * @returns IAdtObject instance for BehaviorDefinition operations
   */
  getBehaviorDefinition<
    R extends IBehaviorDefinitionResults = typeof behaviorDefinitionDocuments,
  >(
    this: this & AdtServedBy<'behaviorDefinition'>,
    results: R = behaviorDefinitionDocuments as unknown as R,
  ): AdtBehaviorDefinition<R, V> {
    this.assertConnected();
    return new AdtBehaviorDefinition<R, V>(
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
  getBehaviorImplementation<R extends IClassResults = typeof classDocuments>(
    this: this & AdtServedBy<'behaviorImplementation'>,
    results: R = classDocuments as unknown as R,
  ): AdtBehaviorImplementation<R> {
    this.assertConnected();
    return new AdtBehaviorImplementation<R>(
      this.connection,
      this.logger,
      this.lockRegistry,
      results,
      this.systemContext,
    );
  }

  /**
   * Get high-level operations for MetadataExtension objects
   * @returns IAdtObject instance for MetadataExtension operations
   */
  getMetadataExtension<
    R extends IMetadataExtensionResults = typeof metadataExtensionDocuments,
  >(
    this: this & AdtServedBy<'metadataExtension'>,
    results: R = metadataExtensionDocuments as unknown as R,
  ): AdtMetadataExtension<R, V> {
    this.assertConnected();
    return new AdtMetadataExtension<R, V>(
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
  getEnhancement<R extends IEnhancementResults = typeof enhancementDocuments>(
    this: this & AdtServedBy<'enhancement'>,
    results: R = enhancementDocuments as unknown as R,
  ): AdtEnhancement<R, V> {
    this.assertConnected();
    return new AdtEnhancement<R, V>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
  }

  /**
   * Get high-level operations for FeatureToggle objects
   * @returns IFeatureToggleObject instance for FeatureToggle operations
   */
  getFeatureToggle<
    R extends IFeatureToggleResults = typeof featureToggleDocuments,
  >(
    this: this & AdtServedBy<'featureToggle'>,
    results: R = featureToggleDocuments as unknown as R,
  ): AdtFeatureToggle<R> {
    this.assertConnected();
    return new AdtFeatureToggle<R>(
      this.connection,
      this.logger,
      this.systemContext,
      this.lockRegistry,
      results,
    );
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
  getRequest<R extends ITransportResults = typeof transportDocuments>(
    this: this & AdtServedBy<'request'>,
    results: R = transportDocuments as unknown as R,
  ): AdtRequest<R, V> {
    this.assertConnected();
    return new AdtRequest<R, V>(
      this.connection,
      this.logger,
      this.systemContext,
      results,
    );
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
  getUtils<R extends IUtilResults = typeof utilDocuments>(
    results: R = utilDocuments as unknown as R,
  ): AdtUtils<R, V> {
    this.assertConnected();
    return new AdtUtils<R, V>(this.connection, this.logger, results);
  }

  /**
   * Get high-level operations for a class's `testclasses` include.
   *
   * No `create`: an include is not brought into existence by a request of its
   * own — it exists because its class does, and writing source into it is
   * `update`. The lock, activation, metadata and transport it exposes are the
   * **container class's**, which is what ADT locks and activates.
   */
  getLocalTestClass<R extends IClassResults = typeof classDocuments>(
    this: this & AdtServedBy<'localTestClass'>,
    results: R = classDocuments as unknown as R,
  ): AdtLocalTestClass<R, V> {
    this.assertConnected();
    return new AdtLocalTestClass<R, V>(
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
  getLocalTypes<R extends IClassResults = typeof classDocuments>(
    this: this & AdtServedBy<'localTypes'>,
    results: R = classDocuments as unknown as R,
  ): AdtLocalTypes<R, V> {
    this.assertConnected();
    return new AdtLocalTypes<R, V>(
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
  getLocalDefinitions<R extends IClassResults = typeof classDocuments>(
    this: this & AdtServedBy<'localDefinitions'>,
    results: R = classDocuments as unknown as R,
  ): AdtLocalDefinitions<R, V> {
    this.assertConnected();
    return new AdtLocalDefinitions<R, V>(
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
  getLocalMacros<R extends IClassResults = typeof classDocuments>(
    this: this & AdtServedBy<'localMacros'>,
    results: R = classDocuments as unknown as R,
  ): AdtLocalMacros<R, V> {
    this.assertConnected();
    return new AdtLocalMacros<R, V>(
      this.connection,
      this.logger,
      this.systemContext,
      this.contentTypes,
      this.lockRegistry,
      results,
    );
  }
}
