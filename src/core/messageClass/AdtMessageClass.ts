/**
 * AdtMessageClass - CRUD for `MSAG/N` message classes.
 *
 * The class is a shell — name, description, package. The messages inside it are
 * written through `AdtMessageClassMessage`. There is no activation: a message
 * class is not an activatable object.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */

import type {
  IAbapConnection,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdatable,
  IAdtValidatable,
  IAnalyse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { deletionRefusal } from '../../utils/deletionCheck';
import { getTimeout } from '../../utils/timeouts';
import { validationRefusal } from '../../utils/validationRefusal';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import { createMessageClass } from './create';
import { checkDeletion, deleteMessageClass } from './delete';
import { lockMessageClass } from './lock';
import { getMessageClassSource } from './read';
import {
  type IMessageClassConfig,
  type IMessageClassResults,
  messageClassDocuments,
} from './types';
import { unlockMessageClass } from './unlock';
import { updateMessageClass } from './update';

const VALIDATE_BASE = '/sap/bc/adt/messageclass/validation';

export class AdtMessageClass<
  R extends IMessageClassResults = typeof messageClassDocuments,
> implements
    IAdtCreatable<IMessageClassConfig, ReturnType<R['created']>>,
    IAdtMetadataReadable<IMessageClassConfig, ReturnType<R['metadata']>>,
    IAdtMetadataUpdatable<
      Partial<IMessageClassConfig>,
      ReturnType<R['metadataUpdated']>
    >,
    IAdtDeletable<
      IMessageClassConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IMessageClassConfig, ReturnType<R['validation']>>,
    IAdtLockable<IMessageClassConfig>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'MessageClass';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = messageClassDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockMessageClass(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake. */
  private name(config: Partial<IMessageClassConfig>): string {
    if (!config.name) {
      throw new Error('Message class name is required');
    }
    return config.name;
  }

  /**
   * Validate name and description.
   *
   * POST with the params in the query string and an empty body — that is what
   * Eclipse sends, and what the other types' validation endpoints take.
   */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const params = new URLSearchParams({ objname: name });
    if (config.description) {
      params.set('description', config.description);
    }

    return answering(
      () =>
        connection.makeAdtRequest({
          url: `${VALIDATE_BASE}?${params.toString()}`,
          method: 'POST',
          timeout: getTimeout('default'),
        }),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the message class shell. No activation — message classes have none. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IMessageClassConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    this.logger?.info?.('Creating message class');
    return answering(
      () =>
        createMessageClass(connection, {
          name,
          description: config.description as string,
          package_name: config.packageName as string,
          // config → global systemContext → 'EN', like class/domain/package.
          master_language:
            config.masterLanguage?.trim() ||
            this.systemContext.masterLanguage?.trim() ||
            'EN',
          // sent as ?corrNr= for a transportable package; empty for local
          transport_request: config.transportRequest,
        }),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** The same document `read` fetches — there is no metadata resource. */
  async readMetadata(
    config: Partial<IMessageClassConfig>,
    options?: {
      withLongPolling?: boolean;
      version?: 'active' | 'inactive';
    } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getMessageClassSource(connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** Update the message class's own metadata: lock → PUT → unlock. */
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadataUpdated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        updateMessageClass(
          connection,
          name,
          options?.lockHandle,
          config.description,
          config.transportRequest,
        ),
      this.results.metadataUpdated as IResultStrategy<
        ReturnType<R['metadataUpdated']>
      >,
      options?.analyse,
    );
  }

  /**
   * Delete the message class.
   *
   * The stateless deletion service (check → delete), no lock: a stateful lock
   * plus a direct DELETE leaves a lingering message-editing enqueue that blocks
   * a same-name re-create. See delete.ts.
   *
   * The check is read, not merely performed — ADT states a refusal inside a
   * 200.
   */
  /**
   * Asks ADT whether the message class can be deleted.
   *
   * Its own member because it is its own endpoint. `delete` no longer runs it:
   * a consumer that wants the check runs this first and decides what a refusal
   * means.
   */
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => checkDeletion(connection, name),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
    );
  }

  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => deleteMessageClass(connection, name, config.transportRequest),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Lock the message class for modification. */
  async lock(
    config: Partial<IMessageClassConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        const lockHandle = await inStatefulSession(this.connection, () =>
          lockMessageClass(this.connection, name),
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

  /** Unlock the message class. */
  async unlock(
    config: Partial<IMessageClassConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        try {
          return await unlockMessageClass(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      () => undefined,
    );
  }
}
