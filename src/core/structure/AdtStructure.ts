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
    IAdtDeletable<
      IStructureConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['check']>
    >,
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
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);

    return answering(
      () => validateStructureName(this.connection, name, config.description),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: IStructureConfig,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    return answering(
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
    );
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IStructureConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
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
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IStructureConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const name = this.name(config);

    return answering(
      () => getStructureMetadata(this.connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IStructureConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
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
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    const source = options?.sourceCode || config.ddlCode;

    if (!source) {
      throw new Error('Source code (ddlCode) is required for update');
    }
    return answering(
      () =>
        upload(
          this.connection,
          {
            structureName: name,
            ddlCode: source as string,
            transportRequest: config.transportRequest,
          },
          options?.lockHandle,
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
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(this.connection, {
          structure_name: name,
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
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        deleteStructure(this.connection, {
          structure_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IStructureConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const name = this.name(config);

    return answering(
      () => activateStructure(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IStructureConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
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
