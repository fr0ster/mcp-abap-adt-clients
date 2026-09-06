/**
 * AdtEnhancement - CRUD for enhancement implementations and spots.
 *
 * Every request needs the **type** as well as the name: the URI differs per
 * enhancement type (`enhoxh`, `enhoxhb`, `enhoxhh`, `enhsxs`, `enhsxsb`), so
 * a config without one cannot be turned into a request at all.
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
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { activateEnhancement } from './activation';
import { check as checkEnhancementSource } from './check';
import { create as createEnhancement } from './create';
import { checkDeletion, deleteEnhancement } from './delete';
import { lockEnhancement } from './lock';
import {
  getEnhancementMetadata,
  getEnhancementSource,
  getEnhancementTransport,
} from './read';
import {
  type EnhancementType,
  enhancementDocuments,
  type IEnhancementConfig,
  type IEnhancementResults,
} from './types';
import { unlockEnhancement } from './unlock';
import { updateEnhancement } from './update';
import { validate as validateEnhancement } from './validation';
import {
  getEnhancementVersionSource,
  getEnhancementVersions,
} from './versions';

export class AdtEnhancement<
  R extends IEnhancementResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IEnhancementResults,
> implements
    IAdtCreatable<IEnhancementConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IEnhancementConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IEnhancementConfig, ReturnType<R['updated']>>,
    IAdtDeletable<
      IEnhancementConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['check']>
    >,
    IAdtValidatable<IEnhancementConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IEnhancementConfig, ReturnType<R['check']>>,
    IAdtActivatable<IEnhancementConfig, ReturnType<R['activation']>>,
    IAdtLockable<IEnhancementConfig>,
    IAdtTransportAware<IEnhancementConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IEnhancementConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  /** The enhancement type each held lock was taken with. */
  private readonly lockedTypes = new Map<string, EnhancementType>();
  public readonly objectType: string = 'Enhancement';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = enhancementDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockEnhancement(
          this.connection,
          this.lockedTypes.get(name) as EnhancementType,
          name,
          lockHandle,
        ),
    );
  }

  /**
   * The enhancement type, or the caller's mistake.
   *
   * Every URI in this module is built from it, so a config without one cannot
   * be turned into a request at all — which is a caller error, not something
   * to discover from a 404.
   */
  private enhancementType(
    config: Partial<IEnhancementConfig>,
  ): EnhancementType {
    if (!config.enhancementType) {
      throw new Error('Enhancement type is required');
    }
    return config.enhancementType;
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IEnhancementConfig>): string {
    if (!config.enhancementName) {
      throw new Error('Enhancement name is required');
    }
    return config.enhancementName;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IEnhancementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);
    const type = this.enhancementType(config);

    return answering(
      () =>
        validateEnhancement(
          this.connection,
          type,
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
    config: IEnhancementConfig,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    const name = this.name(config);
    const type = this.enhancementType(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    return answering(
      () =>
        createEnhancement(
          this.connection,
          {
            enhancement_name: name,
            enhancement_type: type,
            package_name: config.packageName as string,
            description: config.description,
            transport_request: config.transportRequest,
            enhancement_spot: config.enhancementSpot,
            badi_definition: config.badiDefinition,
            masterSystem: this.systemContext.masterSystem,
            responsible: this.systemContext.responsible,
            masterLanguage:
              config.masterLanguage ?? this.systemContext.masterLanguage,
          },
          this.logger,
        ),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IEnhancementConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () =>
        getEnhancementSource(
          this.connection,
          this.enhancementType(config),
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
    config: Partial<IEnhancementConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const name = this.name(config);

    return answering(
      () =>
        getEnhancementMetadata(
          this.connection,
          this.enhancementType(config),
          name,
          options,
          this.logger,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IEnhancementConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    const name = this.name(config);

    return answering(
      () =>
        getEnhancementTransport(
          this.connection,
          this.enhancementType(config),
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
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IEnhancementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    const type = this.enhancementType(config);
    const source = options?.sourceCode || config.sourceCode;

    if (!source) {
      throw new Error('Source code is required for update');
    }
    return answering(
      () =>
        updateEnhancement(
          this.connection,
          type,
          name,
          source as string,
          options?.lockHandle,
          config.transportRequest,
          this.logger,
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
    config: Partial<IEnhancementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(this.connection, {
          enhancement_name: name,
          enhancement_type: this.enhancementType(config),
          transport_request: config.transportRequest,
        }),
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
    config: Partial<IEnhancementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        deleteEnhancement(this.connection, {
          enhancement_name: name,
          enhancement_type: this.enhancementType(config),
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IEnhancementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const name = this.name(config);

    return answering(
      () =>
        activateEnhancement(
          this.connection,
          this.enhancementType(config),
          name,
        ),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IEnhancementConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkEnhancementSource(
          this.connection,
          this.enhancementType(config),
          name,
          version,
          config.sourceCode,
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IEnhancementConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockEnhancement(
          this.connection,
          this.enhancementType(config),
          name,
        );
        this.lockedTypes.set(name, this.enhancementType(config));
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
    config: Partial<IEnhancementConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockEnhancement(
            this.connection,
            this.enhancementType(config),
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
    config: Partial<IEnhancementConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getEnhancementVersions(this.connection, config),
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
        data: await getEnhancementVersionSource(this.connection, contentUri),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => String(answer.data),
    );
  }
}
