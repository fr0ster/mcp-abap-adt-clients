/**
 * AdtFeatureToggle - CRUD for `FTG2/FT` feature toggles, plus the five domain
 * members `IFeatureToggleObject` names: switchOn, switchOff, getRuntimeState,
 * checkState and readSource.
 *
 * Every member — CRUD and domain alike — answers `IAdtResponse<T>`, where T is
 * what the result set given at construction makes of that endpoint's answer.
 */
import type {
  AdtReadVersion,
  IAdtActivatable,
  IAdtActivationOptions,
  IAdtAnalyseOptions,
  IAdtCheckable,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtHeaders,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdatable,
  IAdtUpdateOptions,
  IAdtValidatable,
  IFeatureToggleObject,
  IFeatureToggleResults,
  IFeatureToggleSource,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import {
  nothing,
  type ResultStrategiesOf,
  type ResultValuesOf,
} from '../../utils/resultStrategy';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import { createLockTracker, type LockTracker } from '../shared/LockRegistry';
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
import type {
  featureToggleDocuments,
  ICreateFeatureToggleParams,
  IDeleteFeatureToggleParams,
  IFeatureToggleConfig,
} from './types';
import { unlockFeatureToggle } from './unlock';
import { updateFeatureToggle } from './update';
import { uploadFeatureToggleSource } from './updateSource';
import { validateFeatureToggleName } from './validation';

/** What each slot of the result set answers. */
export type FeatureToggleValues = {
  readonly [K in keyof IFeatureToggleResults]: unknown;
};

export class AdtFeatureToggle<
  T extends FeatureToggleValues = ResultValuesOf<typeof featureToggleDocuments>,
> implements
    IAdtCreatable<IFeatureToggleConfig, T['created']>,
    IAdtReadable<IFeatureToggleConfig, T['source']>,
    IAdtMetadataReadable<IFeatureToggleConfig, T['metadata']>,
    IAdtUpdatable<Partial<IFeatureToggleConfig>, T['updated']>,
    IAdtDeletable<IFeatureToggleConfig, T['deletion'], T['deletionCheck']>,
    IAdtValidatable<IFeatureToggleConfig, T['validation']>,
    IAdtCheckable<IFeatureToggleConfig, T['check']>,
    IAdtActivatable<IFeatureToggleConfig, T['activation']>,
    // No IAdtTransportAware: a feature toggle has no transport resource of its
    // own, and the member that claimed one read the toggle's document instead.
    IAdtLockable<IFeatureToggleConfig>,
    IFeatureToggleObject<{
      switched: T['switched'];
      runtimeState: T['runtimeState'];
      checkState: T['checkState'];
      source: T['sourceDocument'];
    }>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'FeatureToggle';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'systemContext' | 'lockRegistry'
    >,
  ) {
    const { logger, systemContext, lockRegistry } = options;
    this.results = options.results;
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
  ): Promise<IAdtResponse<T['validation'], E>> {
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
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IFeatureToggleConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E>> {
    // **The one guard this package keeps, and only on a create.**
    //
    // The type requires a package; this refuses an empty one, which the type
    // cannot rule out. SAP creates nothing without a package: most creates are
    // refused (CTS_WBO_API 018, "Object cannot be created without a package"),
    // and a message class is answered 201 Created with nothing created (read on
    // premise, 2026-11-02). Refused here, before any request, in words that say
    // why.
    if (!config.packageName) {
      throw new Error(
        'packageName is required for create: SAP creates nothing without one',
      );
    }

    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.name(config);
    return answering(
      () =>
        createFeatureToggle(
          connection,
          options.headers,
          this.createParams(config),
        ),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () => readFeatureToggle(connection, name, version),
      this.results.source,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => readFeatureToggle(connection, name, options?.version),
      this.results.metadata,
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
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        updateFeatureToggle(
          connection,
          options.headers,
          options.ifMatch,
          this.createParams(config as IFeatureToggleConfig),
          options?.lockHandle,
        ),
      this.results.metadataUpdated,
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
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['updated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const source = config.source;

    return answering(
      () =>
        uploadFeatureToggleSource(
          connection,
          options.headers,
          options.ifMatch,
          name,
          source as IFeatureToggleSource,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.updated,
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
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.name(config);
    return answering(
      () =>
        checkDeletion(connection, options.headers, this.deleteParams(config)),
      this.results.deletionCheck,
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
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.name(config);
    return answering(
      () =>
        deleteFeatureToggle(
          connection,
          options.headers,
          this.deleteParams(config),
        ),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        activateFeatureToggle(
          connection,
          options.headers,
          name,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkFeatureToggle(connection, options.headers, name, version),
      this.results.check,
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
  ): Promise<IAdtResponse<T['switched'], E>> {
    return this.switchTo(config, opts, 'on', options);
  }

  /** Switch the toggle off — see {@link switchOn}. */
  async switchOff<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['switched'], E>> {
    return this.switchTo(config, opts, 'off', options);
  }

  private async switchTo<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    opts: { transportRequest: string; userSpecific?: boolean },
    targetState: 'on' | 'off',
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['switched'], E>> {
    const name = this.name(config);
    return answering(
      () =>
        toggleFeatureToggle(this.connection, {
          feature_toggle_name: name,
          state: targetState,
          is_user_specific: Boolean(opts.userSpecific),
          transport_request: opts.transportRequest,
        }),
      this.results.switched,
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
  ): Promise<IAdtResponse<T['runtimeState'], E>> {
    const name = this.name(config);
    return answering(
      () => getFeatureToggleState(this.connection, name),
      this.results.runtimeState,
      options?.analyse,
    );
  }

  /**
   * The current state, and what changing it would require — the `…/check`
   * JSON, read by the `checkState` strategy.
   */
  async checkState<E extends IAdtError = IAdtError>(
    config: Partial<IFeatureToggleConfig>,
    opts: { userSpecific?: boolean } | undefined,
    options: { headers: IAdtHeaders } & IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['checkState'], E>> {
    const name = this.name(config);
    return answering(
      () =>
        checkFeatureToggleState(this.connection, options.headers, name, opts),
      this.results.checkState,
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
    version?: AdtReadVersion,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['sourceDocument'], E>> {
    const name = this.name(config);

    return answering(
      () => readFeatureToggleSource(this.connection, name, version),
      this.results.sourceDocument,
      options?.analyse,
    );
  }
}
