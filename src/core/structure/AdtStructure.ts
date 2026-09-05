/**
 * AdtStructure - CRUD for `TABL/DS` structures.
 *
 * `create` is metadata only; the fields come through `update`, which writes DDL
 * source.
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
import { activateStructure } from './activation';
import { checkStructure } from './check';
import { create as createStructure } from './create';
import { checkDeletion, deleteStructure } from './delete';
import { lockStructure } from './lock';
import {
  getStructureMetadata,
  getStructureSource,
  getStructureTransport,
} from './read';
import {
  type IStructureConfig,
  type IStructureResults,
  structureDocuments,
} from './types';
import { unlockStructure } from './unlock';
import { upload } from './update';
import { validateStructureName } from './validation';
import { getStructureVersionSource, getStructureVersions } from './versions';

export class AdtStructure<
  R extends IStructureResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IStructureResults,
> implements
    IAdtCreatable<IStructureConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IStructureConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IStructureConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IStructureConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IStructureConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IStructureConfig, ReturnType<R['check']>>,
    IAdtActivatable<IStructureConfig, ReturnType<R['activation']>>,
    IAdtLockable<IStructureConfig>,
    IAdtTransportAware<IStructureConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IStructureConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Structure';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = structureDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) => unlockStructure(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IStructureConfig>): string {
    if (!config.structureName) {
      throw new Error('Structure name is required');
    }
    return config.structureName;
  }

  /** Validate the name before creating the object. */
  async validate(
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
    const name = this.name(config);

    return answering(
      () => validateStructureName(this.connection, name, config.description),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the object. */
  async create(
    config: IStructureConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
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
          this.logger?.warn?.('Deleting structure after failure');
          await deleteStructure(this.connection, {
            structure_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Creating structure');
      const value = await step(
        answering(
          () =>
            createStructure(this.connection, {
              structureName: name,
              packageName: config.packageName as string,
              transportRequest: config.transportRequest,
              description: config.description as string,
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
      this.logger?.info?.('Structure created');
      return value;
    });
  }

  /** Read the object. */
  async read(
    config: Partial<IStructureConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () => getStructureSource(this.connection, name, version, options),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata(
    config: Partial<IStructureConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () => getStructureMetadata(this.connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport(
    config: Partial<IStructureConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['transport']>>> {
    const name = this.name(config);

    return answering(
      () =>
        getStructureTransport(
          this.connection,
          name,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
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
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    const name = this.name(config);
    const source = options?.sourceCode || config.ddlCode;

    if (options?.lockHandle) {
      const lockHandle = options.lockHandle;
      if (!source) {
        throw new Error('Source code (ddlCode) is required for update');
      }
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          upload(
            this.connection,
            {
              structureName: name,
              ddlCode: source as string,
              transportRequest: config.transportRequest,
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

      this.logger?.info?.('Step 1: Locking structure');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: on older BASIS a lock handle is
      // only valid inside a stateful request, so going stateless before the
      // unlock would break the unlock (#106); and if the lock itself throws,
      // the session is still restored.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockStructure(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockStructure(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Structure locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () =>
              checkStructure(
                this.connection,
                name,
                'inactive',
                source,
                this.logger,
              ),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      let updated = undefined as ReturnType<R['updated']>;
      if (source) {
        this.logger?.info?.('Step 3: Updating structure');
        updated = await step(
          answering(
            () =>
              upload(
                this.connection,
                {
                  structureName: name,
                  ddlCode: source as string,
                  transportRequest: config.transportRequest,
                },
                lockHandle,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        this.logger?.info?.('Structure updated');

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

      this.logger?.info?.('Step 4: Unlocking structure');
      this.connection.setSessionType('stateful');
      await unlockStructure(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();
      this.logger?.info?.('Structure unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () =>
            checkStructure(
              this.connection,
              name,
              'inactive',
              undefined,
              this.logger,
            ),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating structure');
        await step(
          answering(
            () => activateStructure(this.connection, name),
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
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking structure for deletion');
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              structure_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse ?? deletionRefusal,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting structure');
      const value = await step(
        answering(
          () =>
            deleteStructure(this.connection, {
              structure_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Structure deleted');
      return value;
    });
  }

  /** Activate the object. Needs no stateful session. */
  async activate(
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    const name = this.name(config);

    return answering(
      () => activateStructure(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse ?? activationRefusal,
    );
  }

  /** Check the object. */
  async check(
    config: Partial<IStructureConfig>,
    status?: string,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['check']>>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkStructure(
          this.connection,
          name,
          version,
          config.ddlCode,
          this.logger,
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(config: Partial<IStructureConfig>): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockStructure(this.connection, name);
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
    config: Partial<IStructureConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockStructure(this.connection, name, lockHandle);
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
    config: Partial<IStructureConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getStructureVersions(this.connection, config),
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
        data: await getStructureVersionSource(this.connection, contentUri),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => String(answer.data),
    );
  }
}
