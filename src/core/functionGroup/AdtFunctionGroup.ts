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
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtValidatable,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
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

export class AdtFunctionGroup<
  R extends IFunctionGroupResults = typeof functionGroupDocuments,
> implements
    IAdtCreatable<IFunctionGroupConfig, ReturnType<R['created']>>,
    IAdtMetadataReadable<IFunctionGroupConfig, ReturnType<R['metadata']>>,
    IAdtMetadataUpdatable<
      Partial<IFunctionGroupConfig>,
      ReturnType<R['metadataUpdated']>
    >,
    IAdtDeletable<
      IFunctionGroupConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
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
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    if (!config.functionGroupName) {
      throw new Error('Function group name is required for validation');
    }

    return answering(
      () =>
        validateFunctionGroupName(
          connection,
          config.functionGroupName as string,
          config.packageName,
          config.description,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the function group. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IFunctionGroupConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

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
    return answering(
      () =>
        createFunctionGroup(
          connection,
          {
            functionGroupName: name,
            packageName: config.packageName as string,
            transportRequest: config.transportRequest,
            description: config.description as string,
            masterSystem:
              config.masterSystem ?? this.systemContext.masterSystem,
            responsible: config.responsible ?? this.systemContext.responsible,
            masterLanguage:
              config.masterLanguage ?? this.systemContext.masterLanguage,
          },
          this.logger,
          this.contentTypes,
        ),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
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
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    return answering(
      () =>
        getFunctionGroup(
          connection,
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
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    return answering(
      () =>
        getFunctionGroupTransport(
          connection,
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
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadataUpdated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.description) {
      throw new Error('Description is required for update');
    }
    const name = config.functionGroupName;
    const description = config.description;

    return answering(
      () =>
        updateFunctionGroup(
          connection,
          {
            function_group_name: name,
            description,
            lock_handle: options?.lockHandle as string,
            transport_request: config.transportRequest,
          },
          this.contentTypes,
        ),
      this.results.metadataUpdated as IResultStrategy<
        ReturnType<R['metadataUpdated']>
      >,
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
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const name = config.functionGroupName;
    return answering(
      () =>
        checkDeletion(connection, {
          function_group_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
  }

  /**
   * Delete the function group.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const name = config.functionGroupName;
    return answering(
      () =>
        deleteFunctionGroup(connection, {
          function_group_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the function group. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }

    return answering(
      () =>
        activateFunctionGroup(connection, config.functionGroupName as string),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Check the function group. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkFunctionGroup(
          connection,
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
        const lockHandle = await inStatefulSession(this.connection, () =>
          lockFunctionGroup(this.connection, name),
        );
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
        const result = await inStatefulSession(this.connection, () =>
          unlockFunctionGroup(this.connection, name, lockHandle),
        );
        this.lockTracker.untrack(name);
        return result;
      },
      () => undefined,
    );
  }
}
