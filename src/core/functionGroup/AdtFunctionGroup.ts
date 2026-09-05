/**
 * AdtFunctionGroup - CRUD for `FUGR/F` function groups.
 *
 * A function group is a **container**: it has no source of its own, so `read`
 * answers its metadata document and `update` changes only its description.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 *
 * Operation chains:
 * - Create: validate → create → check → activate (optional)
 * - Update: lock → update → unlock → check → activate (optional)
 * - Delete: check(deletion) → delete
 */

import type {
  AdtNoFailure,
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
  IAdtWireResponse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../utils/activationUtils';
import {
  answering,
  type IAdtOptions,
  type IAnalyse,
} from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { deletionRefusal } from '../../utils/deletionCheck';
import { requestOf } from '../../utils/requestTrace';
import { validationRefusal } from '../../utils/validationRefusal';
import { chain } from '../shared/chain';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateFunctionGroup } from './activation';
import { checkFunctionGroup } from './check';
import { create as createFunctionGroup } from './create';
import { checkDeletion, deleteFunctionGroup } from './delete';
import { lockFunctionGroup } from './lock';
import { getFunctionGroup, getFunctionGroupTransport } from './read';
import {
  functionGroupDocuments,
  type IFunctionGroupConfig,
  type IFunctionGroupResults,
} from './types';
import { unlockFunctionGroup } from './unlock';
import { updateFunctionGroup } from './update';
import { validateFunctionGroupName } from './validation';

/**
 * Kept as the name this module has always exported. The reading is no longer
 * function-group-specific: a DDL source answers the same `200` with
 * `<SEVERITY>ERROR</SEVERITY>` and was not being read at all, so it lives in
 * {@link validationRefusal} and is the default for every type now.
 */
export const validationSeverity = validationRefusal;

export class AdtFunctionGroup<
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
> implements
    IAdtCreatable<IFunctionGroupConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IFunctionGroupConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IFunctionGroupConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IFunctionGroupConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IFunctionGroupConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IFunctionGroupConfig, ReturnType<R['check']>>,
    IAdtActivatable<IFunctionGroupConfig, ReturnType<R['activation']>>,
    IAdtLockable<IFunctionGroupConfig>,
    IAdtTransportAware<IFunctionGroupConfig, ReturnType<R['transport']>>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'FunctionGroup';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default. See AdtClass.
    protected readonly results: R = functionGroupDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.contentTypes = contentTypes;
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (functionGroupName, lockHandle) =>
        unlockFunctionGroup(this.connection, functionGroupName, lockHandle),
    );
  }

  /** Validate a function group name before creating it. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required for validation');
    }

    return answering(
      () =>
        validateFunctionGroupName(
          this.connection,
          config.functionGroupName as string,
          config.packageName,
          config.description,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the function group. */
  async create<E extends IAdtError = IAdtError>(
    config: IFunctionGroupConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    const name = config.functionGroupName;

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure ?? true) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting function group after failure');
          // No stateful needed — the delete uses no lock.
          await deleteFunctionGroup(this.connection, {
            function_group_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Step 1: Validating function group configuration');
      await step(this.validate(config, options));

      this.logger?.info?.('Step 2: Creating function group');
      const value = await step(
        answering(
          () =>
            createFunctionGroup(
              this.connection,
              {
                functionGroupName: name,
                packageName: config.packageName as string,
                transportRequest: config.transportRequest,
                description: config.description as string,
                masterSystem:
                  config.masterSystem ?? this.systemContext.masterSystem,
                responsible:
                  config.responsible ?? this.systemContext.responsible,
                masterLanguage:
                  config.masterLanguage ?? this.systemContext.masterLanguage,
              },
              this.logger,
              this.contentTypes,
            ),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      created = true;
      this.logger?.info?.('Function group created');

      // A readiness poll, not part of the answer: on cloud the object is not
      // always readable the instant the create returns. Its failure is logged
      // and the chain continues, because the create succeeded either way.
      const ready = await this.read({ functionGroupName: name }, 'inactive', {
        withLongPolling: true,
      });
      if (!ready.ok) {
        this.logger?.warn?.(
          'read with long polling failed after create:',
          ready.getError().message,
        );
      }

      this.logger?.info?.('Step 3: Checking created function group');
      await step(this.check({ functionGroupName: name }, 'inactive', options));

      if (options?.activateOnCreate) {
        this.logger?.info?.('Step 4: Activating function group');
        await step(this.activate({ functionGroupName: name }, options));
      }

      return value;
    });
  }

  /**
   * Read the function group.
   *
   * `version` is accepted and ignored: a group is a container, and the resource
   * this reads is its metadata document, which has no active/inactive pair.
   */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    _version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    // No 404 special case: whether an empty or missing answer *is* absence is
    // the caller's reading, supplied through `analyse`.
    return answering(
      () =>
        getFunctionGroup(
          this.connection,
          config.functionGroupName as string,
          options,
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /**
   * Read the group's metadata.
   *
   * The same resource `read` fetches — a group has no source to tell it apart
   * from — declared separately because the contract asks both of a readable.
   */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    return answering(
      () =>
        getFunctionGroup(
          this.connection,
          config.functionGroupName as string,
          options,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the group belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: { withLongPolling?: boolean } & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    return answering(
      () =>
        getFunctionGroupTransport(
          this.connection,
          config.functionGroupName as string,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /**
   * Update the group's description — the only thing a container has to change.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain, so
   * this is one request.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.description) {
      throw new Error('Description is required for update');
    }
    const name = config.functionGroupName;
    const description = config.description;
    const sessionId = this.connection.getSessionId?.() || '';

    if (options?.lockHandle) {
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          updateFunctionGroup(
            this.connection,
            {
              function_group_name: name,
              description,
              lock_handle: options.lockHandle as string,
              transport_request: config.transportRequest,
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

      this.logger?.info?.('Step 1: Locking function group');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: a handle is only valid inside a
      // stateful request on older BASIS (#106).
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockFunctionGroup(
        this.connection,
        name,
        sessionId,
      );
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockFunctionGroup(this.connection, name, lockHandle, sessionId);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Function group locked, handle:', lockHandle);

      this.logger?.info?.('Step 2: Updating function group metadata');
      const updated = await step(
        answering(
          () =>
            updateFunctionGroup(
              this.connection,
              {
                function_group_name: name,
                description,
                transport_request: config.transportRequest,
                lock_handle: lockHandle,
              },
              this.contentTypes,
            ),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Function group updated');

      const ready = await this.read({ functionGroupName: name }, 'active', {
        withLongPolling: true,
      });
      if (!ready.ok) {
        this.logger?.warn?.(
          'read with long polling failed after update:',
          ready.getError().message,
        );
      }

      this.logger?.info?.('Step 3: Unlocking function group');
      this.connection.setSessionType('stateful');
      await unlockFunctionGroup(this.connection, name, lockHandle, sessionId);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      releaseLock();
      this.logger?.info?.('Function group unlocked');

      this.logger?.info?.('Step 4: Final check');
      await step(this.check({ functionGroupName: name }, 'inactive', options));

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 5: Activating function group');
        await step(this.activate({ functionGroupName: name }, options));
      }

      return updated;
    });
  }

  /**
   * Delete the function group.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const name = config.functionGroupName;

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking function group for deletion');
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              function_group_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting function group');
      const value = await step(
        answering(
          () =>
            deleteFunctionGroup(this.connection, {
              function_group_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Function group deleted');
      return value;
    });
  }

  /** Activate the function group. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    return answering(
      () =>
        activateFunctionGroup(
          this.connection,
          config.functionGroupName as string,
        ),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the function group. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    status?: string,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkFunctionGroup(
          this.connection,
          config.functionGroupName as string,
          version,
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the function group for modification. */
  async lock(
    config: Partial<IFunctionGroupConfig>,
  ): Promise<IAdtResponse<string>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const name = config.functionGroupName;

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockFunctionGroup(this.connection, name);
        this.lockTracker.track(name, lockHandle);
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

  /** Unlock the function group. */
  async unlock(
    config: Partial<IFunctionGroupConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const name = config.functionGroupName;

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        const result = await unlockFunctionGroup(
          this.connection,
          name,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(name);
        return result;
      },
      () => undefined,
    );
  }
}
