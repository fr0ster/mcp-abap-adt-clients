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
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdatable,
  IAdtValidatable,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import {
  answering,
  type IAdtOptions,
  type IAnalyse,
} from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { deletionRefusal } from '../../utils/deletionCheck';
import { getTimeout } from '../../utils/timeouts';
import { validationRefusal } from '../../utils/validationRefusal';
import { chain } from '../shared/chain';
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
  R extends IMessageClassResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IMessageClassResults,
> implements
    IAdtCreatable<IMessageClassConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IMessageClassConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IMessageClassConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IMessageClassConfig, ReturnType<R['deletion']>>,
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
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);
    const params = new URLSearchParams({ objname: name });
    if (config.description) {
      params.set('description', config.description);
    }

    return answering(
      () =>
        this.connection.makeAdtRequest({
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
    config: IMessageClassConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
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
        createMessageClass(this.connection, {
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

  /**
   * Read the message class, messages and all.
   *
   * `version` is accepted and ignored: a message class has one document.
   * {@link parseMessageClass} in this module is the reading a consumer can
   * compose if they want the messages as a list rather than the document.
   */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassConfig>,
    _version?: 'active' | 'inactive',
    options?: { withLongPolling?: boolean } & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    const name = this.name(config);

    // No 404 special case: whether an empty or missing answer *is* absence is
    // the caller's reading, supplied through `analyse`.
    return answering(
      () => getMessageClassSource(this.connection, name, options),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
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
    const name = this.name(config);

    return answering(
      () => getMessageClassSource(this.connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** Update the message class's own metadata: lock → PUT → unlock. */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);

    if (options?.lockHandle) {
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          updateMessageClass(
            this.connection,
            name,
            options.lockHandle as string,
            config.description,
            config.transportRequest,
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

      this.logger?.info?.('lock');
      this.connection.setSessionType('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockMessageClass(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockMessageClass(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('locked');

      this.logger?.info?.('update');
      const updated = await step(
        answering(
          () =>
            updateMessageClass(
              this.connection,
              name,
              lockHandle,
              config.description,
              config.transportRequest,
            ),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );

      this.logger?.info?.('unlock');
      await unlockMessageClass(this.connection, name, lockHandle);
      this.lockTracker.untrack(name);
      releaseLock();

      return updated;
    });
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
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IMessageClassConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('delete: check');
      await step(
        answering(
          () => checkDeletion(this.connection, name),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
        ),
      );

      this.logger?.info?.('delete: delete');
      const value = await step(
        answering(
          () =>
            deleteMessageClass(this.connection, name, config.transportRequest),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('deleted');
      return value;
    });
  }

  /** Lock the message class for modification. */
  async lock(
    config: Partial<IMessageClassConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockMessageClass(this.connection, name);
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
