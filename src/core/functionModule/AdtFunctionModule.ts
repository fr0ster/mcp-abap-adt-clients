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
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
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
import { activationRefusal } from '../../utils/activationUtils';
import {
  answering,
  type IAdtOptions,
  type IAnalyse,
} from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { deletionRefusal } from '../../utils/deletionCheck';
import { chain } from '../shared/chain';
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
> implements
    IAdtCreatable<IFunctionModuleConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IFunctionModuleConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IFunctionModuleConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IFunctionModuleConfig, ReturnType<R['deletion']>>,
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
    if (!config.functionModuleName) {
      throw new Error('Function module name is required');
    }
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    return {
      group: config.functionGroupName,
      module: config.functionModuleName,
    };
  }

  /** Validate a function module name before creating it. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const { group, module } = this.names(config);

    return answering(
      () =>
        validateFunctionModuleName(
          this.connection,
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
    config: IFunctionModuleConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    const { group, module } = this.names(config);
    if (!config.description) {
      throw new Error('Description is required');
    }

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting function module after failure');
          // No stateful needed — the delete uses no lock.
          await deleteFunctionModule(this.connection, {
            function_module_name: module,
            function_group_name: group,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Creating function module');
      const value = await step(
        answering(
          () =>
            createFunctionModule(this.connection, {
              functionGroupName: group,
              functionModuleName: module,
              transportRequest: config.transportRequest,
              description: config.description as string,
              masterSystem:
                config.masterSystem ?? this.systemContext.masterSystem,
              responsible: config.responsible ?? this.systemContext.responsible,
            }),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      created = true;
      this.logger?.info?.('Function module created');
      return value;
    });
  }

  /** Read the module's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    const { group, module } = this.names(config);

    // No 404 special case: whether an empty answer *is* absence is the caller's
    // reading, supplied through `analyse`.
    return answering(
      () => getFunctionSource(this.connection, module, group, version, options),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the module's metadata. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const { group, module } = this.names(config);

    return answering(
      () => getFunctionMetadata(this.connection, module, group, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the module belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: { withLongPolling?: boolean } & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    const { group, module } = this.names(config);

    return answering(
      () =>
        getFunctionModuleTransport(
          this.connection,
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
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const { group, module } = this.names(config);
    const source = options?.sourceCode || config.sourceCode;

    if (options?.lockHandle) {
      if (!source) {
        throw new Error('Source code is required for update');
      }
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          update(
            this.connection,
            {
              functionModuleName: module,
              functionGroupName: group,
              sourceCode: source,
              lockHandle: options.lockHandle as string,
              transportRequest: config.transportRequest,
            },
            this.contentTypes,
          ),
        this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
        options?.analyse,
      );
    }

    // A LOCK…UNLOCK window: a timeout in the middle releases the lock and
    // leaves the work half done.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Step 1: Locking function module');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: a handle is only valid inside a
      // stateful request on older BASIS (#106).
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockFunctionModule(
        this.connection,
        group,
        module,
      );
      this.trackLock(group, module, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockFunctionModule(this.connection, group, module, lockHandle);
        this.untrackLock(group, module);
      });
      this.logger?.info?.('Function module locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () =>
              checkFunctionModule(
                this.connection,
                group,
                module,
                'inactive',
                source,
                this.contentTypes,
              ),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      let updated = undefined as ReturnType<R['updated']>;
      if (source) {
        this.logger?.info?.('Step 3: Updating function module');
        updated = await step(
          answering(
            () =>
              update(
                this.connection,
                {
                  functionGroupName: group,
                  functionModuleName: module,
                  sourceCode: source,
                  lockHandle,
                  transportRequest: config.transportRequest,
                },
                this.contentTypes,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        this.logger?.info?.('Function module updated');

        // The write produced the inactive version; the active one may not exist
        // yet. A failure here is not the update's failure, so it is logged and
        // the chain continues — the unlock still has to happen.
        const ready = await this.read(config, 'inactive', {
          withLongPolling: true,
        });
        if (!ready.ok) {
          this.logger?.warn?.(
            'read with long polling failed after update:',
            ready.getError().message,
          );
        }
      }

      this.logger?.info?.('Step 4: Unlocking function module');
      this.connection.setSessionType('stateful');
      await unlockFunctionModule(this.connection, group, module, lockHandle);
      this.connection.setSessionType('stateless');
      this.untrackLock(group, module);
      releaseLock();
      this.logger?.info?.('Function module unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(this.check(config, 'inactive', options));

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating function module');
        await step(this.activate(config, options));

        const ready = await this.read(config, 'active', {
          withLongPolling: true,
        });
        if (!ready.ok) {
          this.logger?.warn?.(
            'read with long polling failed after activation:',
            ready.getError().message,
          );
        }
      }

      return updated;
    });
  }

  /**
   * Delete the function module.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const { group, module } = this.names(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking function module for deletion');
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              function_module_name: module,
              function_group_name: group,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting function module');
      const value = await step(
        answering(
          () =>
            deleteFunctionModule(this.connection, {
              function_module_name: module,
              function_group_name: group,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Function module deleted');
      return value;
    });
  }

  /** Activate the function module. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const { group, module } = this.names(config);

    return answering(
      () => activateFunctionModule(this.connection, group, module),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the function module. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionModuleConfig>,
    status?: string,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const { group, module } = this.names(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkFunctionModule(
          this.connection,
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
        this.connection.setSessionType('stateful');
        const lockHandle = await lockFunctionModule(
          this.connection,
          group,
          module,
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
        this.connection.setSessionType('stateful');
        const result = await unlockFunctionModule(
          this.connection,
          group,
          module,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
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
