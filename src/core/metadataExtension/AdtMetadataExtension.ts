/**
 * AdtMetadataExtension - CRUD for `DDLX/EX` metadata extensions.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
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
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { lockHandleOf } from '../../utils/lockHandle';
import { nothing } from '../../utils/resultStrategy';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import { checkDeletionByUri } from '../shared/deletionCheckByUri';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
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
  R extends IMetadataExtensionResults = typeof metadataExtensionDocuments,
> implements
    IAdtCreatable<IMetadataExtensionConfig, ReturnType<R['created']>>,
    IAdtReadable<IMetadataExtensionConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IMetadataExtensionConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<IMetadataExtensionConfig>, ReturnType<R['updated']>>,
    IAdtDeletable<
      IMetadataExtensionConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IMetadataExtensionConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IMetadataExtensionConfig, ReturnType<R['check']>>,
    IAdtActivatable<IMetadataExtensionConfig, ReturnType<R['activation']>>,
    IAdtLockable<IMetadataExtensionConfig>,
    IAdtTransportAware<IMetadataExtensionConfig, ReturnType<R['transport']>>,
    IAdtVersionable<
      IMetadataExtensionConfig,
      ReturnType<R['versions']>,
      ReturnType<R['versionSource']>
    >
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

  /**
   * The name as the caller gave it.
   *
   * No guard: the config's type says the field is there, and a `Partial<>` at
   * the call site is what widens it. A caller who passes nothing builds a URL
   * from nothing and the server answers — which is a reading a strategy can
   * take, where a sentence composed here would not be.
   */
  private name(config: Partial<IMetadataExtensionConfig>): string {
    return config.name as string;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        validateMetadataExtension(connection, {
          name,
          description: config.description ?? name,
          packageName: config.packageName as string,
        }),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IMetadataExtensionConfig, 'source'> & {
      source?: never;
    },
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

    const name = this.name(config);
    return answering(
      () =>
        createMetadataExtension(connection, {
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () =>
        readMetadataExtensionSource(
          connection,
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => readMetadataExtension(connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getMetadataExtensionTransport(connection, name, options),
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
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    // The source is the caller's, through `options.source`. This used to
    // fall back to `config.source` — two channels for one value, where the
    // contract documents one. `config.source` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.source;

    return answering(
      () =>
        updateMetadataExtension(
          connection,
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        checkDeletionByUri(
          connection,
          `/sap/bc/adt/ddic/ddlx/sources/${encodeSapObjectName(name).toLowerCase()}`,
        ),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
  }

  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () => deleteMetadataExtension(connection, name, config.transportRequest),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => activateMetadataExtension(connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkMetadataExtension(connection, name, version),
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
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const name = this.name(config);
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockMetadataExtension(this.connection, name),
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
    config: Partial<IMetadataExtensionConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
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
      nothing,
      options?.analyse,
    );
  }

  /** Version history of the object's source. */
  async getVersions<E extends IAdtError = IAdtError>(
    config: Partial<IMetadataExtensionConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['versions']>, E>> {
    return answering(
      () => getMetadataExtensionVersions(this.connection, config),
      this.results.versions as IResultStrategy<ReturnType<R['versions']>>,
      options?.analyse,
    );
  }

  /** Source of one version, by the `contentUri` its entry carried. */
  async getVersionSource<E extends IAdtError = IAdtError>(
    contentUri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['versionSource']>, E>> {
    return answering(
      () => getMetadataExtensionVersionSource(this.connection, contentUri),
      this.results.versionSource as IResultStrategy<
        ReturnType<R['versionSource']>
      >,
      options?.analyse,
    );
  }
}
