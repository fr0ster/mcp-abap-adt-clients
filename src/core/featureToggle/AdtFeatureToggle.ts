/**
 * AdtFeatureToggle - CRUD for `FTG2/FT` feature toggles, plus the five domain
 * members `IFeatureToggleObject` names: switchOn, switchOff, getRuntimeState,
 * checkState and readSource.
 *
 * Every CRUD member answers `IAdtResponse<T>`, where T is what the result set
 * given at construction makes of that endpoint's answer. The five domain
 * members answer the runtime-state shapes this module declares — that is what
 * the questions are for.
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
  IAdtUpdatable,
  IAdtValidatable,
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
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateFeatureToggle } from './activation';
import { checkFeatureToggle } from './check';
import { checkFeatureToggleState } from './checkState';
import { create as createFeatureToggle } from './create';
import { checkDeletion, deleteFeatureToggle } from './delete';
import { getFeatureToggleState } from './getState';
import { lockFeatureToggle } from './lock';
import { readFeatureToggle } from './read';
import { readFeatureToggleSource } from './readSource';
import { toggleFeatureToggle } from './switch';
import {
  featureToggleDocuments,
  type ICreateFeatureToggleParams,
  type IDeleteFeatureToggleParams,
  type IFeatureToggleCheckStateResult,
  type IFeatureToggleConfig,
  type IFeatureToggleResults,
  type IFeatureToggleRuntimeState,
} from './types';
import { unlockFeatureToggle } from './unlock';
import { updateFeatureToggle } from './update';
import { validateFeatureToggleName } from './validation';

export class AdtFeatureToggle<
  R extends IFeatureToggleResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IFeatureToggleResults,
> implements
    IAdtCreatable<IFeatureToggleConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IFeatureToggleConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IFeatureToggleConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IFeatureToggleConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IFeatureToggleConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IFeatureToggleConfig, ReturnType<R['check']>>,
    IAdtActivatable<IFeatureToggleConfig, ReturnType<R['activation']>>,
    // No IAdtTransportAware: a feature toggle has no transport resource of its
    // own, and the member that claimed one read the toggle's document instead.
    IAdtLockable<IFeatureToggleConfig>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'FeatureToggle';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = featureToggleDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockFeatureToggle(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IFeatureToggleConfig>): string {
    if (!config.featureToggleName) {
      throw new Error('Feature toggle name is required');
    }
    return config.featureToggleName;
  }

  /** Map camelCase config to the snake_case low-level params. */
  private createParams(
    config: IFeatureToggleConfig,
  ): ICreateFeatureToggleParams {
    return {
      feature_toggle_name: config.featureToggleName,
      package_name: config.packageName ?? '',
      description: config.description,
      transport_request: config.transportRequest,
      master_system: config.masterSystem ?? this.systemContext.masterSystem,
      responsible: config.responsible ?? this.systemContext.responsible,
      source: config.source,
    };
  }

  private deleteParams(
    config: Partial<IFeatureToggleConfig>,
  ): IDeleteFeatureToggleParams {
    return {
      feature_toggle_name: config.featureToggleName ?? '',
      transport_request: config.transportRequest,
    };
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);

    return answering(
      () =>
        validateFeatureToggleName(
          this.connection,
          name,
          config.packageName,
          config.description,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: IFeatureToggleConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
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
          this.logger?.warn?.('Deleting feature toggle after failure');
          await deleteFeatureToggle(this.connection, this.deleteParams(config));
        });
      }

      this.logger?.info?.('Creating feature toggle');
      const value = await step(
        answering(
          () => createFeatureToggle(this.connection, this.createParams(config)),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      // Only past the step: a refused create leaves nothing to delete, and the
      // cleanup above must not remove an object this call did not make.
      created = true;
      this.logger?.info?.('Feature toggle created');
      return value;
    });
  }

  /** Read the object. */
  async read(
    config: Partial<IFeatureToggleConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () => readFeatureToggle(this.connection, name, version),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata(
    config: Partial<IFeatureToggleConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () => readFeatureToggle(this.connection, name, options?.version),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
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
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    const source = options?.sourceCode;

    if (options?.lockHandle) {
      const lockHandle = options.lockHandle;
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          updateFeatureToggle(
            this.connection,
            this.createParams(config as IFeatureToggleConfig),
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

      this.logger?.info?.('Step 1: Locking feature toggle');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: on older BASIS a lock handle is
      // only valid inside a stateful request, so going stateless before the
      // unlock would break the unlock (#106); and if the lock itself throws,
      // the session is still restored.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockFeatureToggle(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockFeatureToggle(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Feature toggle locked, handle:', lockHandle);

      // No check before the write: a toggle's own check run applies to the
      // activated object, not to metadata it has not seen yet.

      // Always written: the fields come from the config, not from a
      // source string a caller may or may not have passed, so there is
      // nothing to skip and nothing to leave undefined.
      this.logger?.info?.('Step 3: Updating feature toggle');
      const updated = await step(
        answering(
          () =>
            updateFeatureToggle(
              this.connection,
              this.createParams(config as IFeatureToggleConfig),
              lockHandle,
            ),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Feature toggle updated');

      // The write produced the inactive version, and that is the one polled:
      // the active one still holds the pre-update content, so waiting on it
      // returns something the update cannot have changed. A failure here is not
      // the update's failure, so it is logged and the chain continues — the
      // unlock still has to happen.
      const ready = await this.read(config, 'inactive', {
        withLongPolling: true,
      });
      if (!ready.ok) {
        this.logger?.warn?.(
          'read with long polling failed after update:',
          ready.getError().message,
        );
      }

      this.logger?.info?.('Step 4: Unlocking feature toggle');
      this.connection.setSessionType('stateful');
      await unlockFeatureToggle(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();
      this.logger?.info?.('Feature toggle unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () => checkFeatureToggle(this.connection, name, 'inactive'),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating feature toggle');
        await step(
          answering(
            () => activateFeatureToggle(this.connection, name),
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
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking feature toggle for deletion');
      await step(
        answering(
          () => checkDeletion(this.connection, this.deleteParams(config)),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting feature toggle');
      const value = await step(
        answering(
          () => deleteFeatureToggle(this.connection, this.deleteParams(config)),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Feature toggle deleted');
      return value;
    });
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const name = this.name(config);

    return answering(
      () => activateFeatureToggle(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    status?: string,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkFeatureToggle(this.connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockFeatureToggle(this.connection, name);
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
    config: Partial<IFeatureToggleConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockFeatureToggle(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      () => undefined,
    );
  }

  /**
   * Switch the toggle on, and answer the state that produced.
   *
   * The switch itself answers nothing worth reading, so the state is read back
   * — which is also the only way a caller learns whether the change took at the
   * level they asked for.
   */
  async switchOn(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IAdtResponse<IFeatureToggleRuntimeState>> {
    return this.switchTo(config, opts, 'on');
  }

  /** Switch the toggle off — see {@link switchOn}. */
  async switchOff(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IAdtResponse<IFeatureToggleRuntimeState>> {
    return this.switchTo(config, opts, 'off');
  }

  private async switchTo(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
    targetState: 'on' | 'off',
  ): Promise<IAdtResponse<IFeatureToggleRuntimeState>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      await step(
        answering(
          () =>
            toggleFeatureToggle(this.connection, {
              feature_toggle_name: name,
              state: targetState,
              is_user_specific: Boolean(opts.userSpecific),
              transport_request: opts.transportRequest,
            }),
          () => undefined,
        ),
      );

      return step(this.getRuntimeState(config));
    });
  }

  /** What the toggle is set to right now, per client and per user. */
  async getRuntimeState(
    config: Partial<IFeatureToggleConfig>,
  ): Promise<IAdtResponse<IFeatureToggleRuntimeState>> {
    const name = this.name(config);

    return answering(
      async () => ({
        data: await getFeatureToggleState(this.connection, name),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => answer.data as unknown as IFeatureToggleRuntimeState,
    );
  }

  /** The current state, and what changing it would require. */
  async checkState(
    config: Partial<IFeatureToggleConfig>,
    opts?: { userSpecific?: boolean },
  ): Promise<IAdtResponse<IFeatureToggleCheckStateResult>> {
    const name = this.name(config);

    return answering(
      async () => ({
        data: await checkFeatureToggleState(this.connection, name, opts),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => answer.data as unknown as IFeatureToggleCheckStateResult,
    );
  }

  /**
   * The toggle's source document.
   *
   * A separate resource from `read`, which fetches the toggle itself. The JSON
   * is handed over as it arrived — a caller who wants
   * {@link IFeatureToggleSource} parsed out supplies a strategy that does it,
   * rather than this member deciding for everyone.
   */
  async readSource(
    config: Partial<IFeatureToggleConfig>,
    version: 'active' | 'inactive' = 'active',
  ): Promise<IAdtResponse<ReturnType<R['sourceDocument']>>> {
    const name = this.name(config);

    return answering(
      () => readFeatureToggleSource(this.connection, name, version),
      this.results.sourceDocument as IResultStrategy<
        ReturnType<R['sourceDocument']>
      >,
    );
  }
}
