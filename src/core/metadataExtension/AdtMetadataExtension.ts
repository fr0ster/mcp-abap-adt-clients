/**
 * AdtMetadataExtension - CRUD for `DDLX/EX` metadata extensions.
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
import { encodeSapObjectName } from '../../utils/internalUtils';
import { validationRefusal } from '../../utils/validationRefusal';
import { checkDeletionByUri } from '../shared/deletionCheckByUri';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { activateMetadataExtension } from './activate';
import { checkMetadataExtension } from './check';
import { createMetadataExtension } from './create';
import { deleteMetadataExtension } from './delete';
import { lockMetadataExtension } from './lock';
import {
  getMetadataExtensionTransport,
  readMetadataExtension,
  readMetadataExtensionSource,
} from './read';
import {
  type IMetadataExtensionConfig,
  type IMetadataExtensionResults,
  metadataExtensionDocuments,
} from './types';
import { unlockMetadataExtension } from './unlock';
import { updateMetadataExtension } from './update';
import { validateMetadataExtension } from './validation';
import {
  getMetadataExtensionVersionSource,
  getMetadataExtensionVersions,
} from './versions';

export class AdtMetadataExtension<
  R extends IMetadataExtensionResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IMetadataExtensionResults,
> implements
    IAdtCreatable<IMetadataExtensionConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IMetadataExtensionConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IMetadataExtensionConfig, ReturnType<R['updated']>>,
    IAdtDeletable<
      IMetadataExtensionConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletion']>
    >,
    IAdtValidatable<IMetadataExtensionConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IMetadataExtensionConfig, ReturnType<R['check']>>,
    IAdtActivatable<IMetadataExtensionConfig, ReturnType<R['activation']>>,
    IAdtLockable<IMetadataExtensionConfig>,
    IAdtTransportAware<IMetadataExtensionConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IMetadataExtensionConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'MetadataExtension';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = metadataExtensionDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockMetadataExtension(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IMetadataExtensionConfig>): string {
    if (!config.name) {
      throw new Error('Name is required');
    }
    return config.name;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }

    return answering(
      () =>
        validateMetadataExtension(this.connection, {
          name,
          description: config.description ?? name,
          packageName: config.packageName as string,
        }),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: IMetadataExtensionConfig,
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
        createMetadataExtension(this.connection, {
          name,
          description: config.description as string,
          packageName: config.packageName as string,
          transportRequest: config.transportRequest,
          masterLanguage: config.masterLanguage,
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
        }),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () =>
        readMetadataExtensionSource(
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
    config: Partial<IMetadataExtensionConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const name = this.name(config);

    return answering(
      () => readMetadataExtension(this.connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    const name = this.name(config);

    return answering(
      () => getMetadataExtensionTransport(this.connection, name, options),
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
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    const source = options?.sourceCode || config.sourceCode;

    if (!source) {
      throw new Error('Source code is required for update');
    }
    return answering(
      () =>
        updateMetadataExtension(
          this.connection,
          name,
          source as string,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
      options?.analyse,
    );
  }

  /** Delete the object. */
  /**
   * Ask whether the object can be deleted now.
   *
   * Its delete is a DELETE on its own URL rather than the deletion service, but
   * the question is the service's either way: it is asked about an address.
   */
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    const name = this.name(config);

    return answering(
      () =>
        checkDeletionByUri(
          this.connection,
          `/sap/bc/adt/ddic/ddlx/sources/${encodeSapObjectName(name).toLowerCase()}`,
        ),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
    );
  }

  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        deleteMetadataExtension(this.connection, name, config.transportRequest),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const name = this.name(config);

    return answering(
      () => activateMetadataExtension(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkMetadataExtension(this.connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IMetadataExtensionConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockMetadataExtension(this.connection, name);
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
    config: Partial<IMetadataExtensionConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockMetadataExtension(
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
    config: Partial<IMetadataExtensionConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getMetadataExtensionVersions(this.connection, config),
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
        data: await getMetadataExtensionVersionSource(
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
