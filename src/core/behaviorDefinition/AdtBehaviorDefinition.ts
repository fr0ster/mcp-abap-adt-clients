/**
 * AdtBehaviorDefinition - CRUD for `BDEF/BDO` behavior definitions.
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
import { answering } from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { deletionRefusal } from '../../utils/deletionCheck';
import { chain } from '../shared/chain';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { activate as activateBehaviorDefinition } from './activation';
import { check as checkBehaviorDefinition } from './check';
import { create as createBehaviorDefinition } from './create';
import { checkDeletion, deleteBehaviorDefinition } from './delete';
import { lock as lockBehaviorDefinition } from './lock';
import {
  getBehaviorDefinitionTransport,
  read as readBehaviorDefinition,
  readSource as readBehaviorDefinitionSource,
} from './read';
import {
  type BehaviorDefinitionImplementationType,
  behaviorDefinitionDocuments,
  type IBehaviorDefinitionConfig,
  type IBehaviorDefinitionResults,
} from './types';
import { unlock as unlockBehaviorDefinition } from './unlock';
import { update as updateBehaviorDefinition } from './update';
import { validate as validateBehaviorDefinition } from './validation';
import {
  getBehaviorDefinitionVersionSource,
  getBehaviorDefinitionVersions,
} from './versions';

export class AdtBehaviorDefinition<
  R extends IBehaviorDefinitionResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IBehaviorDefinitionResults,
> implements
    IAdtCreatable<IBehaviorDefinitionConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IBehaviorDefinitionConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IBehaviorDefinitionConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IBehaviorDefinitionConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IBehaviorDefinitionConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IBehaviorDefinitionConfig, ReturnType<R['check']>>,
    IAdtActivatable<IBehaviorDefinitionConfig, ReturnType<R['activation']>>,
    IAdtLockable<IBehaviorDefinitionConfig>,
    IAdtTransportAware<IBehaviorDefinitionConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IBehaviorDefinitionConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'BehaviorDefinition';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = behaviorDefinitionDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockBehaviorDefinition(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IBehaviorDefinitionConfig>): string {
    if (!config.name) {
      throw new Error('Behavior definition name is required');
    }
    return config.name;
  }

  /** Validate the name before creating the object. */
  async validate(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
    const name = this.name(config);
    // The endpoint takes all five: a validation with fewer is a 400 to decode
    // later rather than a caller error named here.
    if (!config.rootEntity) {
      throw new Error('Root entity is required for validation');
    }
    if (!config.description) {
      throw new Error('Description is required for validation');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }
    if (!config.implementationType) {
      throw new Error('Implementation type is required for validation');
    }

    return answering(
      () =>
        validateBehaviorDefinition(this.connection, {
          objname: name,
          rootEntity: config.rootEntity as string,
          description: config.description as string,
          package: config.packageName as string,
          implementationType:
            config.implementationType as BehaviorDefinitionImplementationType,
        }),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the object. */
  async create(
    config: IBehaviorDefinitionConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.rootEntity) {
      throw new Error('Root entity is required');
    }
    if (!config.implementationType) {
      throw new Error('Implementation type is required');
    }

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting behavior definition after failure');
          await deleteBehaviorDefinition(
            this.connection,
            name,
            config.transportRequest,
          );
        });
      }

      this.logger?.info?.('Creating behavior definition');
      const value = await step(
        answering(
          () =>
            createBehaviorDefinition(this.connection, {
              name,
              package: config.packageName as string,
              description: config.description as string,
              implementationType:
                config.implementationType as BehaviorDefinitionImplementationType,
              transportRequest: config.transportRequest,
              language:
                config.masterLanguage ?? this.systemContext.masterLanguage,
              masterSystem: this.systemContext.masterSystem,
              responsible: this.systemContext.responsible,
            }),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      // Only past the step: a refused create leaves nothing to delete, and the
      // cleanup above must not remove an object this call did not make.
      created = true;
      this.logger?.info?.('Behavior definition created');
      return value;
    });
  }

  /** Read the object. */
  async read(
    config: Partial<IBehaviorDefinitionConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () =>
        readBehaviorDefinitionSource(
          this.connection,
          name,
          version ?? 'active',
          options,
          this.logger,
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () =>
        readBehaviorDefinition(
          this.connection,
          name,
          '',
          options?.version ?? 'active',
          options,
          this.logger,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['transport']>>> {
    const name = this.name(config);

    return answering(
      () => getBehaviorDefinitionTransport(this.connection, name, options),
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
  async update(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
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
          updateBehaviorDefinition(this.connection, {
            name,
            sourceCode: source as string,
            lockHandle,
            transportRequest: config.transportRequest,
          }),
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

      this.logger?.info?.('Step 1: Locking behavior definition');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: on older BASIS a lock handle is
      // only valid inside a stateful request, so going stateless before the
      // unlock would break the unlock (#106); and if the lock itself throws,
      // the session is still restored.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockBehaviorDefinition(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockBehaviorDefinition(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Behavior definition locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () =>
              checkBehaviorDefinition(
                this.connection,
                name,
                'abapCheckRun',
                '',
                'inactive',
                source,
              ),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      let updated = undefined as ReturnType<R['updated']>;
      if (source) {
        this.logger?.info?.('Step 3: Updating behavior definition');
        updated = await step(
          answering(
            () =>
              updateBehaviorDefinition(this.connection, {
                name,
                sourceCode: source as string,
                lockHandle,
                transportRequest: config.transportRequest,
              }),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        this.logger?.info?.('Behavior definition updated');

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

      this.logger?.info?.('Step 4: Unlocking behavior definition');
      this.connection.setSessionType('stateful');
      await unlockBehaviorDefinition(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();
      this.logger?.info?.('Behavior definition unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () =>
            checkBehaviorDefinition(
              this.connection,
              name,
              'abapCheckRun',
              '',
              'inactive',
            ),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating behavior definition');
        await step(
          answering(
            () => activateBehaviorDefinition(this.connection, name),
            this.results.activation as IResultStrategy<
              ReturnType<R['activation']>
            >,
            options?.analyse ?? activationRefusal,
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
  async delete(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking behavior definition for deletion');
      await step(
        answering(
          () => checkDeletion(this.connection, name),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse ?? deletionRefusal,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting behavior definition');
      const value = await step(
        answering(
          () =>
            deleteBehaviorDefinition(
              this.connection,
              name,
              config.transportRequest,
            ),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Behavior definition deleted');
      return value;
    });
  }

  /** Activate the object. Needs no stateful session. */
  async activate(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    const name = this.name(config);

    return answering(
      () => activateBehaviorDefinition(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse ?? activationRefusal,
    );
  }

  /** Check the object. */
  async check(
    config: Partial<IBehaviorDefinitionConfig>,
    status?: string,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['check']>>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkBehaviorDefinition(
          this.connection,
          name,
          'abapCheckRun',
          '',
          version,
          config.sourceCode,
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IBehaviorDefinitionConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockBehaviorDefinition(this.connection, name);
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
    config: Partial<IBehaviorDefinitionConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockBehaviorDefinition(
            this.connection,
            name,
            lockHandle,
          );
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
    config: Partial<IBehaviorDefinitionConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getBehaviorDefinitionVersions(this.connection, config),
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
        data: await getBehaviorDefinitionVersionSource(
          this.connection,
          contentUri,
        ),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => String(answer.data),
    );
  }
}
