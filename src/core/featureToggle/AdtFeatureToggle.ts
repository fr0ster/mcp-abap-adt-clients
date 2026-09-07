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
  IAnalyse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../utils/activationUtils';
import { answering } from '../../utils/adtResponse';
import { deletionRefusal } from '../../utils/deletionCheck';
import { validationRefusal } from '../../utils/validationRefusal';
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
    options?: IAdtOperationOptions<E>,
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
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IFeatureToggleConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    return answering(
      () => createFeatureToggle(this.connection, this.createParams(config)),
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
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const name = this.name(config);

    return answering(
      () => readFeatureToggle(this.connection, name, options?.version),
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
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadataUpdated']>, E>> {
    return answering(
      () =>
        updateFeatureToggle(
          this.connection,
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
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    const source = config.source;
    if (!source) {
      throw new Error('source is required to write a feature toggle source');
    }

    return answering(
      () =>
        uploadFeatureToggleSource(
          this.connection,
          name,
          source,
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
    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.name(config);
    return answering(
      () => checkDeletion(this.connection, this.deleteParams(config)),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
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
    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.name(config);
    return answering(
      () => deleteFeatureToggle(this.connection, this.deleteParams(config)),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IAdtOperationOptions<E>,
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
    options?: IAdtOperationOptions<E>,
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
        // Stateful for the LOCK request alone — see LockCapability.
        this.connection.setSessionType('stateless');
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
  ): Promise<IAdtResponse<undefined>> {
    return this.switchTo(config, opts, 'on');
  }

  /** Switch the toggle off — see {@link switchOn}. */
  async switchOff(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
  ): Promise<IAdtResponse<undefined>> {
    return this.switchTo(config, opts, 'off');
  }

  private async switchTo(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
    targetState: 'on' | 'off',
  ): Promise<IAdtResponse<undefined>> {
    const name = this.name(config);
    return answering(
      () =>
        toggleFeatureToggle(this.connection, {
          feature_toggle_name: name,
          state: targetState,
          is_user_specific: Boolean(opts.userSpecific),
          transport_request: opts.transportRequest,
        }),
      () => undefined,
    );
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
