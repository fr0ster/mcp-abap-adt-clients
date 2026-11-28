import type {
  AdtReadVersion,
  AdtRequiredUpdateOptions,
  IAdtLockedWrite,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
/**
 * AdtFunctionModule - CRUD for `FUGR/FF` function modules.
 *
 * A module lives inside its function group, so every request needs both names
 * and the lock is registered under the pair.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 *
 * Operation chains:
 * - Create: create
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import type {
  AdtObjectIdentity,
  AdtVariant,
  IAdtActivatable,
  IAdtActivationOptions,
  IAdtAnalyseOptions,
  IAdtCheckable,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtHeaders,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtUpdateOptions,
  IAdtValidatable,
  IAdtVersionable,
  IFunctionModuleResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { FUNCTION_MODULE } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import {
  nothing,
  type ResultStrategiesOf,
  type ResultValuesOf,
} from '../../utils/resultStrategy';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import { writeObjectDocument } from '../shared/documentWrite';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import type { LockRegistry } from '../shared/LockRegistry';
import { failedWireStatus } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateFunctionModule } from './activation';
import { checkFunctionModule } from './check';
import { create as createFunctionModule } from './create';
import { checkDeletion, deleteFunctionModule } from './delete';
import { lockFunctionModule } from './lock';
import {
  getFunctionMetadata,
  getFunctionModuleTransport,
  getFunctionSource,
} from './read';
import type { functionModuleDocuments, IFunctionModuleConfig } from './types';
import { unlockFunctionModule } from './unlock';
import { update } from './update';
import { validateFunctionModuleName } from './validation';
import {
  getFunctionModuleVersionSource,
  getFunctionModuleVersions,
} from './versions';

/** What each slot of the result set answers. */
export type FunctionModuleValues = {
  readonly [K in keyof IFunctionModuleResults]: unknown;
};

export class AdtFunctionModule<
  T extends FunctionModuleValues = ResultValuesOf<
    typeof functionModuleDocuments
  >,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtCreatable<IFunctionModuleConfig, T['created']>,
    IAdtReadable<
      IFunctionModuleConfig,
      T['source'],
      'functionGroupName' | 'functionModuleName'
    >,
    IAdtMetadataReadable<
      IFunctionModuleConfig,
      T['metadata'],
      'functionGroupName' | 'functionModuleName'
    >,
    IAdtUpdatable<
      Partial<IFunctionModuleConfig>,
      T['updated'],
      'functionGroupName' | 'functionModuleName',
      'source'
    >,
    IAdtMetadataUpdatable<
      Partial<IFunctionModuleConfig>,
      T['metadataUpdated'],
      'functionGroupName' | 'functionModuleName',
      'source'
    >,
    IAdtDeletable<
      IFunctionModuleConfig,
      T['deletion'],
      'functionGroupName' | 'functionModuleName',
      T['deletionCheck']
    >,
    // The validation names the module's group and its description; the
    // module's own name is what it validates.
    IAdtValidatable<
      IFunctionModuleConfig,
      T['validation'],
      'functionGroupName' | 'functionModuleName' | 'description'
    >,
    IAdtCheckable<
      IFunctionModuleConfig,
      T['check'],
      'functionGroupName' | 'functionModuleName'
    >,
    IAdtActivatable<
      IFunctionModuleConfig,
      T['activation'],
      'functionGroupName' | 'functionModuleName'
    >,
    IAdtLockable<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    IAdtTransportAware<
      IFunctionModuleConfig,
      T['transport'],
      'functionGroupName' | 'functionModuleName'
    >,
    IAdtVersionable<
      IFunctionModuleConfig,
      T['versions'],
      T['versionSource'],
      'functionGroupName' | 'functionModuleName'
    >
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  private readonly lockRegistry?: LockRegistry;
  public readonly objectType: string = 'FunctionModule';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'systemContext' | 'contentTypes' | 'lockRegistry'
    >,
  ) {
    const { logger, systemContext, contentTypes, lockRegistry } = options;
    this.results = options.results;
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.contentTypes = contentTypes;
    this.lockRegistry = lockRegistry;
  }

  /** Registry key for a held lock (nested: group + module). */
  private lockKey(group: string, moduleName: string): string {
    return `${this.objectType}/${group.toUpperCase()}/${moduleName.toUpperCase()}`;
  }

  /** Record a held lock; the unlock thunk needs the parent function group. */
  private trackLock(
    group: string,
    moduleName: string,
    lockHandle: string,
  ): void {
    // Raw unlock — LockRegistry.unlockAll() manages the session for the batch.
    this.lockRegistry?.track(this.lockKey(group, moduleName), () =>
      unlockFunctionModule(this.connection, group, moduleName, lockHandle),
    );
  }

  /** Drop a lock from the registry after a clean unlock. */
  private untrackLock(group: string, moduleName: string): void {
    this.lockRegistry?.untrack(this.lockKey(group, moduleName));
  }

  /** Both names, or the caller's mistake. */
  private names(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
  ): {
    group: string;
    module: string;
  } {
    return {
      group: config.functionGroupName,
      module: config.functionModuleName,
    };
  }

  /**
   * Validate a function module name before creating it.
   *
   * The description is required: the endpoint answers 400 without one
   * (measured), so a validation without it is no validation.
   */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName' | 'description'
    >,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName' | 'description'
    >,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName' | 'description'
    >,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);

    return answering(
      () =>
        validateFunctionModuleName(
          connection,
          group,
          module,
          config.description,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the function module. */
  create<E extends IAdtError>(
    config: Omit<IFunctionModuleConfig, 'source'> & {
      source?: never;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  create(
    config: Omit<IFunctionModuleConfig, 'source'> & {
      source?: never;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IFunctionModuleConfig, 'source'> & {
      source?: never;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    return answering(
      () =>
        createFunctionModule(connection, options.headers, {
          functionGroupName: group,
          functionModuleName: module,
          transportRequest: config.transportRequest,
          description: config.description,
          masterSystem: config.masterSystem ?? this.systemContext.masterSystem,
          responsible: config.responsible ?? this.systemContext.responsible,
        }),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the module's source. */
  read<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    version: AdtReadVersion | undefined,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  read(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async read<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);

    // No 404 special case: whether an empty answer *is* absence is the caller's
    // reading, supplied through `analyse`.
    return answering(
      () => getFunctionSource(connection, module, group, version, options),
      this.results.source,
      options?.analyse,
    );
  }

  /** Read the module's metadata. */
  readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);

    return answering(
      () => getFunctionMetadata(connection, module, group, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /** The transport request the module belongs to. */
  readTransport<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'transport'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  readTransport(
    this: this & AdtPerformedBy<'functionModule', 'transport'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'transport'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);

    return answering(
      () =>
        getFunctionModuleTransport(
          connection,
          module,
          group,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport,
      options?.analyse,
    );
  }

  /**
   * Write the module's source.
   *
   * One request: the write, under the lock the caller holds
   * (`options.lockHandle`, required). The lock, the check and the unlock are
   * the caller's own calls of `lock`, `check` and `unlock`.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  update<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>>;
  update(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], IAdtError>>;
  async update<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    // The source is the caller's, through `options.source`. This used to
    // fall back to `config.source` — two channels for one value, where the
    // contract documents one. `config.source` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.source;

    return answering(
      () =>
        update(connection, options.headers, options.ifMatch, {
          functionModuleName: module,
          functionGroupName: group,
          sourceCode: source,
          lockHandle: options?.lockHandle,
          transportRequest: config.transportRequest,
        }),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Write the function module's metadata document — one PUT of
   * `options.source`, as the caller built it, under the caller's
   * `options.lockHandle` (and `config.transportRequest` as `corrNr`), with
   * the caller's headers.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`), change what you mean to change,
   * and pass the result: anything left out is gone, because nothing is read
   * here to keep it.
   */
  updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'updateMetadata'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    this: this & AdtPerformedBy<'functionModule', 'updateMetadata'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'updateMetadata'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);

    return answering(
      () =>
        writeObjectDocument(
          connection,
          options.headers,
          options.ifMatch,
          FUNCTION_MODULE.uri(group, module),
          options?.source,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.metadataUpdated,
      options?.analyse,
    );
  }

  /**
   * Asks ADT whether the object can be deleted.
   *
   * Its own member because it is its own endpoint. `delete` no longer runs
   * it: a consumer that wants the check runs this first and decides what a
   * refusal means.
   */
  checkDeletion<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'deletionCheck'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  checkDeletion(
    this: this & AdtPerformedBy<'functionModule', 'deletionCheck'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionModule', 'deletionCheck'>,
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          function_module_name: module,
          function_group_name: group,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck,
      options?.analyse,
    );
  }

  /**
   * Delete the function module.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  delete<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    return answering(
      () =>
        deleteFunctionModule(connection, options.headers, {
          function_module_name: module,
          function_group_name: group,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the function module. Needs no stateful session. */
  activate<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>>;
  activate(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['activation'], IAdtError>>;
  async activate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);

    return answering(
      () =>
        activateFunctionModule(
          connection,
          options.headers,
          group,
          module,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Check the function module. */
  check<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  check(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  async check<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkFunctionModule(
          connection,
          options.headers,
          group,
          module,
          version,
          undefined,
          this.contentTypes,
        ),
      this.results.check,
      options?.analyse,
    );
  }

  /**
   * Lock the function module — one LOCK, its handle read by `lockHandleOf`. A
   * 200 carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  lock<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const { group, module } = this.names(config);
    return answering(
      async () => {
        const locked = await inStatefulSession(this.connection, () =>
          lockFunctionModule(this.connection, group, module),
        );
        // The registry records SAP's state, not the caller's verdict: a lock
        // SAP granted (a 2xx carrying a handle) is recorded here, before any
        // `analyse` runs, so one it reports as a failure, or throws over, is
        // still released by `unlockAll`.
        const handle = lockHandleOf(locked);
        if (!failedWireStatus(locked) && handle) {
          this.trackLock(group, module, handle);
        }
        return locked;
      },
      lockHandleOf,
      options?.analyse,
    );
  }

  /** Unlock the function module. */
  unlock<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const { group, module } = this.names(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        const result = await inStatefulSession(this.connection, () =>
          unlockFunctionModule(this.connection, group, module, lockHandle),
        );
        // The registry records SAP's state, not the caller's verdict: the lock
        // leaves it only when SAP answered the UNLOCK with a 2xx, before any
        // `analyse` runs; a refused or unanswered one may leave it held.
        if (!failedWireStatus(result)) this.untrackLock(group, module);
        return result;
      },
      nothing,
      options?.analyse,
    );
  }

  /** Version history of the object's source. */
  getVersions<E extends IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>>;
  getVersions(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versions'], IAdtError>>;
  async getVersions<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IFunctionModuleConfig,
      'functionGroupName' | 'functionModuleName'
    >,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>> {
    return answering(
      () => getFunctionModuleVersions(this.connection, config),
      this.results.versions,
      options?.analyse,
    );
  }

  /** Source of one version, by the `contentUri` its entry carried. */
  getVersionSource<E extends IAdtError>(
    contentUri: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versionSource'], E | IAdtError>>;
  getVersionSource(
    contentUri: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versionSource'], IAdtError>>;
  async getVersionSource<E extends IAdtError = IAdtError>(
    contentUri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versionSource'], E | IAdtError>> {
    return answering(
      () => getFunctionModuleVersionSource(this.connection, contentUri),
      this.results.versionSource,
      options?.analyse,
    );
  }
}
