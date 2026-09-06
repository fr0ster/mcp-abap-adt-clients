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
  IAdtError,
  IAdtLockable,
  IAdtMetadataReadable,
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
    unknown,
    unknown
  > = IBehaviorDefinitionResults,
> implements
    IAdtCreatable<IBehaviorDefinitionConfig, ReturnType<R['created']>>,
    IAdtReadable<IBehaviorDefinitionConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IBehaviorDefinitionConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<IBehaviorDefinitionConfig, ReturnType<R['updated']>>,
    IAdtDeletable<
      IBehaviorDefinitionConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
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
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
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
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: IBehaviorDefinitionConfig,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
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
    return answering(
      () =>
        createBehaviorDefinition(this.connection, {
          name,
          package: config.packageName as string,
          description: config.description as string,
          implementationType:
            config.implementationType as BehaviorDefinitionImplementationType,
          transportRequest: config.transportRequest,
          language: config.masterLanguage ?? this.systemContext.masterLanguage,
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
        }),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorDefinitionConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
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
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
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
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
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
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    const source = options?.sourceCode || config.sourceCode;

    if (!source) {
      throw new Error('Source code is required for update');
    }
    return answering(
      () =>
        updateBehaviorDefinition(this.connection, {
          name,
          sourceCode: source as string,
          lockHandle: options?.lockHandle,
          transportRequest: config.transportRequest,
        }),
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
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    const name = this.name(config);
    return answering(
      () => checkDeletion(this.connection, name),
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
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        deleteBehaviorDefinition(
          this.connection,
          name,
          config.transportRequest,
        ),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorDefinitionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const name = this.name(config);

    return answering(
      () => activateBehaviorDefinition(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorDefinitionConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
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
