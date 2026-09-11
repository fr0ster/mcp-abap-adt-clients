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
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import type { LockRegistry } from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
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
import {
  functionModuleDocuments,
  type IFunctionModuleConfig,
  type IFunctionModuleResults,
} from './types';
import { unlockFunctionModule } from './unlock';
import { update } from './update';
import { validateFunctionModuleName } from './validation';
import {
  getFunctionModuleVersionSource,
  getFunctionModuleVersions,
} from './versions';

export class AdtFunctionModule<
  R extends IFunctionModuleResults = typeof functionModuleDocuments,
> implements
    IAdtCreatable<IFunctionModuleConfig, ReturnType<R['created']>>,
    IAdtReadable<IFunctionModuleConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IFunctionModuleConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<IFunctionModuleConfig>, ReturnType<R['updated']>>,
    IAdtDeletable<
      IFunctionModuleConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IFunctionModuleConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IFunctionModuleConfig, ReturnType<R['check']>>,
    IAdtActivatable<IFunctionModuleConfig, ReturnType<R['activation']>>,
    IAdtLockable<IFunctionModuleConfig>,
    IAdtTransportAware<IFunctionModuleConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IFunctionModuleConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  private readonly lockRegistry?: LockRegistry;
  public readonly objectType: string = 'FunctionModule';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default. See AdtClass.
    protected readonly results: R = functionModuleDocuments as unknown as R,
  ) {
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
  private names(config: Partial<IFunctionModuleConfig>): {
    group: string;
    module: string;
  } {
    return {
      group: config.functionGroupName as string,
      module: config.functionModuleName as string,
    };
  }

  /** Validate a function module name before creating it. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
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
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the function module. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IFunctionModuleConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    return answering(
      () =>
        createFunctionModule(connection, {
          functionGroupName: group,
          functionModuleName: module,
          transportRequest: config.transportRequest,
          description: config.description as string,
          masterSystem: config.masterSystem ?? this.systemContext.masterSystem,
          responsible: config.responsible ?? this.systemContext.responsible,
        }),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the module's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);

    // No 404 special case: whether an empty answer *is* absence is the caller's
    // reading, supplied through `analyse`.
    return answering(
      () => getFunctionSource(connection, module, group, version, options),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the module's metadata. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);

    return answering(
      () => getFunctionMetadata(connection, module, group, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the module belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
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
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /**
   * Write the module's source.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain, so
   * this is one request. Without it, this locks, checks, writes and unlocks —
   * and the unlock happens on every path out.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    // The source is the caller's, through `options.sourceCode`. This used to
    // fall back to `config.sourceCode` — two channels for one value, where the
    // contract documents one. `config.sourceCode` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.sourceCode;

    return answering(
      () =>
        update(
          connection,
          {
            functionModuleName: module,
            functionGroupName: group,
            sourceCode: source as string,
            lockHandle: options?.lockHandle as string,
            transportRequest: config.transportRequest,
          },
          this.contentTypes,
        ),
      this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
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
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    return answering(
      () =>
        checkDeletion(connection, {
          function_module_name: module,
          function_group_name: group,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
  }

  /**
   * Delete the function module.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    return answering(
      () =>
        deleteFunctionModule(connection, {
          function_module_name: module,
          function_group_name: group,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the function module. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);

    return answering(
      () => activateFunctionModule(connection, group, module),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Check the function module. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, module } = this.names(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkFunctionModule(
          connection,
          group,
          module,
          version,
          undefined,
          this.contentTypes,
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the function module for modification. */
  async lock(
    config: Partial<IFunctionModuleConfig>,
  ): Promise<IAdtResponse<string>> {
    const { group, module } = this.names(config);

    return answering(
      async () => {
        const lockHandle = await inStatefulSession(this.connection, () =>
          lockFunctionModule(this.connection, group, module),
        );
        this.trackLock(group, module, lockHandle);
        // The handle is the value, and the request does not keep the wire it
        // came on — so the answer is built around what the request produced.
        return {
          data: lockHandle,
          status: 200,
          statusText: 'OK',
          headers: {},
        };
      },
      (answer) => String(answer.data),
    );
  }

  /** Unlock the function module. */
  async unlock(
    config: Partial<IFunctionModuleConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const { group, module } = this.names(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        const result = await inStatefulSession(this.connection, () =>
          unlockFunctionModule(this.connection, group, module, lockHandle),
        );
        this.untrackLock(group, module);
        return result;
      },
      () => undefined,
    );
  }

  /** Version history of the module's source. */
  async getVersions(
    config: Partial<IFunctionModuleConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getFunctionModuleVersions(this.connection, config),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => answer.data as ObjectVersion[],
    );
  }

  /** The source of one version, by the `contentUri` an entry carries. */
  async getVersionSource(contentUri: string): Promise<IAdtResponse<string>> {
    return answering(
      async () => ({
        data: await getFunctionModuleVersionSource(this.connection, contentUri),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => String(answer.data),
    );
  }
}
