/**
 * AdtAccessControl - CRUD for `DCLS/DL` access controls (DCL sources).
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */
import type {
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
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
import { validationRefusal } from '../../utils/validationRefusal';
import { chain } from '../shared/chain';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { activateAccessControl } from './activation';
import { checkAccessControl } from './check';
import { create as createAccessControl } from './create';
import { checkDeletion, deleteAccessControl } from './delete';
import { lockAccessControl } from './lock';
import {
  getAccessControl,
  getAccessControlSource,
  getAccessControlTransport,
} from './read';
import {
  accessControlDocuments,
  type IAccessControlConfig,
  type IAccessControlResults,
} from './types';
import { unlockAccessControl } from './unlock';
import { updateAccessControl } from './update';
import { validateAccessControlName } from './validation';
import {
  getAccessControlVersionSource,
  getAccessControlVersions,
} from './versions';

export class AdtAccessControl<
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
> implements
    IAdtCreatable<IAccessControlConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IAccessControlConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IAccessControlConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IAccessControlConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IAccessControlConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IAccessControlConfig, ReturnType<R['check']>>,
    IAdtActivatable<IAccessControlConfig, ReturnType<R['activation']>>,
    IAdtLockable<IAccessControlConfig>,
    IAdtTransportAware<IAccessControlConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IAccessControlConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'AccessControl';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = accessControlDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockAccessControl(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IAccessControlConfig>): string {
    if (!config.accessControlName) {
      throw new Error('Access control name is required');
    }
    return config.accessControlName;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IAccessControlConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }

    return answering(
      () =>
        validateAccessControlName(
          this.connection,
          name,
          config.packageName as string,
          config.description,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: IAccessControlConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting access control after failure');
          await deleteAccessControl(this.connection, {
            access_control_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Creating access control');
      const value = await step(
        answering(
          () =>
            createAccessControl(this.connection, {
              access_control_name: name,
              description: config.description,
              package_name: config.packageName as string,
              transport_request: config.transportRequest,
              masterSystem: this.systemContext.masterSystem,
              responsible: this.systemContext.responsible,
              masterLanguage:
                config.masterLanguage ?? this.systemContext.masterLanguage,
            }),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      // Only past the step: a refused create leaves nothing to delete, and the
      // cleanup above must not remove an object this call did not make.
      created = true;
      this.logger?.info?.('Access control created');
      return value;
    });
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IAccessControlConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () =>
        getAccessControlSource(
          this.connection,
          name,
          version ?? 'active',
          options,
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IAccessControlConfig>,
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const name = this.name(config);

    return answering(
      () =>
        getAccessControl(
          this.connection,
          name,
          options?.version ?? 'active',
          options,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IAccessControlConfig>,
    options?: { withLongPolling?: boolean } & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    const name = this.name(config);

    return answering(
      () => getAccessControlTransport(this.connection, name, options),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /**
   * Write the object.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain, so
   * this is one request. Without it, this locks, checks, writes and unlocks —
   * and the unlock happens on every path out.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IAccessControlConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    const source = options?.sourceCode || config.sourceCode;

    if (options?.lockHandle) {
      const lockHandle = options.lockHandle;
      if (!source) {
        throw new Error('Source code is required for update');
      }
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          updateAccessControl(
            this.connection,
            {
              access_control_name: name,
              source_code: source as string,
              transport_request: config.transportRequest,
            },
            lockHandle,
          ),
        this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
        options?.analyse,
      );
    }

    // A LOCK…UNLOCK window: a timeout in the middle releases the lock and
    // leaves the work half done, so the connection is told this is critical.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Step 1: Locking access control');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: on older BASIS a lock handle is
      // only valid inside a stateful request, so going stateless before the
      // unlock would break the unlock (#106); and if the lock itself throws,
      // the session is still restored.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockAccessControl(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockAccessControl(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Access control locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () => checkAccessControl(this.connection, name, 'inactive', source),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      let updated = undefined as ReturnType<R['updated']>;
      if (source) {
        this.logger?.info?.('Step 3: Updating access control');
        updated = await step(
          answering(
            () =>
              updateAccessControl(
                this.connection,
                {
                  access_control_name: name,
                  source_code: source as string,
                  transport_request: config.transportRequest,
                },
                lockHandle,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        this.logger?.info?.('Access control updated');

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

      this.logger?.info?.('Step 4: Unlocking access control');
      this.connection.setSessionType('stateful');
      await unlockAccessControl(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();
      this.logger?.info?.('Access control unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () => checkAccessControl(this.connection, name, 'inactive'),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating access control');
        await step(
          answering(
            () => activateAccessControl(this.connection, name),
            this.results.activation as IResultStrategy<
              ReturnType<R['activation']>
            >,
            (options?.analyse ?? activationRefusal) as IAnalyse<E>,
          ),
        );

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
   * Delete the object.
   *
   * The deletion check is read, not merely performed: ADT answers a refusal
   * with `del:isDeletable="false"` inside a 200, and a delete that ignored it
   * reported success while the object stayed. {@link deletionRefusal} is the
   * shipped reading of that answer; a caller who wants another passes their own
   * `analyse`.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IAccessControlConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking access control for deletion');
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              access_control_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting access control');
      const value = await step(
        answering(
          () =>
            deleteAccessControl(this.connection, {
              access_control_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Access control deleted');
      return value;
    });
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IAccessControlConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const name = this.name(config);

    return answering(
      () => activateAccessControl(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IAccessControlConfig>,
    status?: string,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkAccessControl(this.connection, name, version, config.sourceCode),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IAccessControlConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockAccessControl(this.connection, name);
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

  /** Unlock the object. */
  async unlock(
    config: Partial<IAccessControlConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockAccessControl(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      () => undefined,
    );
  }

  /** Version history of the object's source. */
  async getVersions(
    config: Partial<IAccessControlConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getAccessControlVersions(this.connection, config),
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
        data: await getAccessControlVersionSource(this.connection, contentUri),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => String(answer.data),
    );
  }
}
