/**
 * AdtFeatureToggle - CRUD for `FTG2/FT` feature toggles, plus the five domain
 * members `IFeatureToggleObject` names: switchOn, switchOff, getRuntimeState,
 * checkState and readSource.
 *
 * Every member — CRUD and domain alike — answers `IAdtResponse<T>`, where T is
 * what the result set given at construction makes of that endpoint's answer.
 */
import type {
  IAdtActivatable,
  IAdtAnalyseOptions,
  IAdtCheckable,
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
  IAdtUpdatable,
  IAdtValidatable,
  IFeatureToggleObject,
  IFeatureToggleSource,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import { nothing } from '../../utils/resultStrategy';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
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
  type IFeatureToggleConfig,
  type IFeatureToggleResults,
} from './types';
import { unlockFeatureToggle } from './unlock';
import { updateFeatureToggle } from './update';
import { uploadFeatureToggleSource } from './updateSource';
import { validateFeatureToggleName } from './validation';

export class AdtFeatureToggle<
  R extends IFeatureToggleResults = typeof featureToggleDocuments,
> implements
    IAdtCreatable<IFeatureToggleConfig, ReturnType<R['created']>>,
    IAdtReadable<IFeatureToggleConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IFeatureToggleConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<IFeatureToggleConfig>, ReturnType<R['updated']>>,
    IAdtDeletable<
      IFeatureToggleConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IFeatureToggleConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IFeatureToggleConfig, ReturnType<R['check']>>,
    IAdtActivatable<IFeatureToggleConfig, ReturnType<R['activation']>>,
    // No IAdtTransportAware: a feature toggle has no transport resource of its
    // own, and the member that claimed one read the toggle's document instead.
    IAdtLockable<IFeatureToggleConfig>,
    IFeatureToggleObject<{
      switched: ReturnType<R['switched']>;
      runtimeState: ReturnType<R['runtimeState']>;
      checkState: ReturnType<R['checkState']>;
      source: ReturnType<R['sourceDocument']>;
    }>
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

  /**
   * The name as the caller gave it.
   *
   * No guard: the config's type says the field is there, and a `Partial<>` at
   * the call site is what widens it. A caller who passes nothing builds a URL
   * from nothing and the server answers — which is a reading a strategy can
   * take, where a sentence composed here would not be.
   */
  private name(config: Partial<IFeatureToggleConfig>): string {
    return config.featureToggleName as string;
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
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        validateFeatureToggleName(
          connection,
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
    config: Omit<IFeatureToggleConfig, 'source'> & { source?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // **The one guard this package keeps, and only on a create.**
    //
    // An object created without a package is the single thing `delete()` cannot
    // undo: the deletion check resolves through the package, so it answers
    // "Object does not exist" while the name stays taken for good, and clearing
    // it is SAP GUI territory. Everywhere else a missing field produces a
    // request the server answers, which is a reading a strategy can take. Here
    // it produces a state with no way out through ADT at all.
    if (!config.packageName) {
      throw new Error(
        'packageName is required for create: an object created without one cannot be deleted through ADT',
      );
    }

    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.name(config);
    return answering(
      () => createFeatureToggle(connection, this.createParams(config)),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () => readFeatureToggle(connection, name, version),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => readFeatureToggle(connection, name, options?.version),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /**
   * Write the toggle's own document.
   *
   * A feature toggle is one of three types with two writable resources: this
   * document at `/sfw/featuretoggles/{name}`, and its JSON source at
   * `source/main`, which `update` writes.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadataUpdated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        updateFeatureToggle(
          connection,
          this.createParams(config as IFeatureToggleConfig),
          options?.lockHandle,
        ),
      this.results.metadataUpdated as IResultStrategy<
        ReturnType<R['metadataUpdated']>
      >,
      options?.analyse,
    );
  }

  /**
   * Write the toggle's JSON source — the rollout, the toggled packages and the
   * attributes.
   *
   * There was no member for this at all until 18.0.0: `uploadFeatureToggleSource`
   * existed and nothing reached it, while `update` wrote the document. Now the
   * names say which resource each one addresses, as everywhere else.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const source = config.source;

    return answering(
      () =>
        uploadFeatureToggleSource(
          connection,
          name,
          source as IFeatureToggleSource,
          options?.lockHandle,
          config.transportRequest,
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
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.name(config);
    return answering(
      () => checkDeletion(connection, this.deleteParams(config)),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
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
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.name(config);
    return answering(
      () => deleteFeatureToggle(connection, this.deleteParams(config)),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => activateFeatureToggle(connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkFeatureToggle(connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /**
   * Lock the object — one LOCK, its handle read by `lockHandleOf`. A 200
   * carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const name = this.name(config);
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockFeatureToggle(this.connection, name),
        ),
      lockHandleOf,
      options?.analyse,
    );
    if (answer.ok && answer.getResult().value) {
      this.lockTracker.track(name, answer.getResult().value);
    }
    return answer;
  }

  /** Unlock the object. */
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
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
      nothing,
      options?.analyse,
    );
  }

  /**
   * Switch the toggle on — one POST to `…/toggle`, read by the `switched`
   * strategy.
   *
   * The switch answers nothing worth reading by default; a caller who wants to
   * know whether the change took at the level they asked for reads
   * `getRuntimeState` next. (This comment used to say the state was read back
   * here; it was not.)
   */
  async switchOn<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['switched']>, E>> {
    return this.switchTo(config, opts, 'on', options);
  }

  /** Switch the toggle off — see {@link switchOn}. */
  async switchOff<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['switched']>, E>> {
    return this.switchTo(config, opts, 'off', options);
  }

  private async switchTo<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
    targetState: 'on' | 'off',
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['switched']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        toggleFeatureToggle(this.connection, {
          feature_toggle_name: name,
          state: targetState,
          is_user_specific: Boolean(opts.userSpecific),
          transport_request: opts.transportRequest,
        }),
      this.results.switched as IResultStrategy<ReturnType<R['switched']>>,
      options?.analyse,
    );
  }

  /**
   * What the toggle is set to right now, per client and per user — the
   * `…/states` JSON, read by the `runtimeState` strategy.
   */
  async getRuntimeState<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['runtimeState']>, E>> {
    const name = this.name(config);
    return answering(
      () => getFeatureToggleState(this.connection, name),
      this.results.runtimeState as IResultStrategy<
        ReturnType<R['runtimeState']>
      >,
      options?.analyse,
    );
  }

  /**
   * The current state, and what changing it would require — the `…/check`
   * JSON, read by the `checkState` strategy.
   */
  async checkState<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    opts?: { userSpecific?: boolean },
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['checkState']>, E>> {
    const name = this.name(config);
    return answering(
      () => checkFeatureToggleState(this.connection, name, opts),
      this.results.checkState as IResultStrategy<ReturnType<R['checkState']>>,
      options?.analyse,
    );
  }

  /**
   * The toggle's source document.
   *
   * A separate resource from `read`, which fetches the toggle itself. The JSON
   * is handed over as it arrived — a caller who wants `IFeatureToggleSource`
   * parsed out supplies a strategy that does it, rather than this member
   * deciding for everyone.
   */
  async readSource<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    version: 'active' | 'inactive' = 'active',
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['sourceDocument']>, E>> {
    const name = this.name(config);

    return answering(
      () => readFeatureToggleSource(this.connection, name, version),
      this.results.sourceDocument as IResultStrategy<
        ReturnType<R['sourceDocument']>
      >,
      options?.analyse,
    );
  }
}
