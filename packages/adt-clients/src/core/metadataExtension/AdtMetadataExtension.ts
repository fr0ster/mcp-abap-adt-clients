/**
 * AdtMetadataExtension - CRUD for `DDLX/EX` metadata extensions.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */
import type {
  AdtObjectIdentity,
  AdtReadVersion,
  AdtRequiredUpdateOptions,
  AdtVariant,
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
  IAdtLockedWrite,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtUpdateOptions,
  IAdtValidatable,
  IAdtVersionable,
  IAnalyse,
  IMetadataExtensionResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { METADATA_EXTENSION } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import {
  nothing,
  type ResultStrategiesOf,
  type ResultValuesOf,
} from '../../utils/resultStrategy';
import { createLanguage } from '../../utils/xml';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import { checkDeletionByUri } from '../shared/deletionCheckByUri';
import { writeObjectDocument } from '../shared/documentWrite';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import {
  createLockTracker,
  failedWireStatus,
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
import type {
  IMetadataExtensionConfig,
  metadataExtensionDocuments,
} from './types';
import { unlockMetadataExtension } from './unlock';
import { updateMetadataExtension } from './update';
import { validateMetadataExtension } from './validation';
import {
  getMetadataExtensionVersionSource,
  getMetadataExtensionVersions,
} from './versions';

/** What each slot of the result set answers. */
export type MetadataExtensionValues = {
  readonly [K in keyof IMetadataExtensionResults]: unknown;
};

export class AdtMetadataExtension<
  T extends MetadataExtensionValues = ResultValuesOf<
    typeof metadataExtensionDocuments
  >,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtCreatable<IMetadataExtensionConfig, T['created']>,
    IAdtReadable<IMetadataExtensionConfig, T['source'], 'name'>,
    IAdtMetadataReadable<IMetadataExtensionConfig, T['metadata'], 'name'>,
    IAdtUpdatable<
      Partial<IMetadataExtensionConfig>,
      T['updated'],
      'name',
      'source'
    >,
    IAdtMetadataUpdatable<
      Partial<IMetadataExtensionConfig>,
      T['metadataUpdated'],
      'name',
      'source'
    >,
    IAdtDeletable<
      IMetadataExtensionConfig,
      T['deletion'],
      'name',
      T['deletionCheck']
    >,
    IAdtValidatable<IMetadataExtensionConfig, T['validation'], 'name'>,
    IAdtCheckable<IMetadataExtensionConfig, T['check'], 'name'>,
    IAdtActivatable<IMetadataExtensionConfig, T['activation'], 'name'>,
    IAdtLockable<IMetadataExtensionConfig, 'name'>,
    IAdtTransportAware<IMetadataExtensionConfig, T['transport'], 'name'>,
    IAdtVersionable<
      IMetadataExtensionConfig,
      T['versions'],
      T['versionSource'],
      'name'
    >
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'MetadataExtension';

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
  private name(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
  ): string {
    return config.name;
  }

  /** Validate the name before creating the object. */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        validateMetadataExtension(connection, {
          name,
          description: config.description ?? name,
          packageName: config.packageName ?? '',
        }),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the object. */
  create<E extends IAdtError>(
    config: Omit<IMetadataExtensionConfig, 'source'> & {
      source?: never;
      packageName: string;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  create(
    config: Omit<IMetadataExtensionConfig, 'source'> & {
      source?: never;
      packageName: string;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IMetadataExtensionConfig, 'source'> & {
      source?: never;
      packageName: string;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E | IAdtError>> {
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

    const name = this.name(config);
    return answering(
      () =>
        createMetadataExtension(connection, options.headers, {
          name,
          description: config.description,
          packageName: config.packageName,
          transportRequest: config.transportRequest,
          masterLanguage: createLanguage(
            config.masterLanguage,
            this.systemContext.masterLanguage,
          ),
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
        }),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the object. */
  read<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    version: AdtReadVersion | undefined,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  read(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async read<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () => readMetadataExtensionSource(connection, name, version, options),
      this.results.source,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => readMetadataExtension(connection, name, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  readTransport<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  readTransport(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  async readTransport<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getMetadataExtensionTransport(connection, name, options),
      this.results.transport,
      options?.analyse,
    );
  }

  /**
   * Write the object.
   *
   * One request: the write, under the lock the caller holds
   * (`options.lockHandle`, required). The lock, the check and the unlock are
   * the caller's own calls of `lock`, `check` and `unlock`.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  update<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>>;
  update(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], IAdtError>>;
  async update<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>> {
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
          options.headers,
          options.ifMatch,
          name,
          source,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /** Delete the object. */
  /**
   * Write the metadata extension's metadata document — one PUT of `options.source`,
   * as the caller built it, under the caller's `options.lockHandle` (and
   * `config.transportRequest` as `corrNr`), with the caller's headers.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`), change what you mean to change,
   * and pass the result: anything left out is gone, because nothing is read
   * here to keep it.
   */
  updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'metadataExtension', 'updateMetadata'>,
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    this: this & AdtPerformedBy<'metadataExtension', 'updateMetadata'>,
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'metadataExtension', 'updateMetadata'>,
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        writeObjectDocument(
          connection,
          options.headers,
          options.ifMatch,
          METADATA_EXTENSION.uri(this.name(config)),
          options?.source,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.metadataUpdated,
      options?.analyse,
    );
  }

  /**
   * Ask whether the object can be deleted now.
   *
   * Its delete is a DELETE on its own URL rather than the deletion service, but
   * the question is the service's either way: it is asked about an address.
   */
  checkDeletion<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  checkDeletion(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        checkDeletionByUri(
          connection,
          options.headers,
          `${METADATA_EXTENSION.uri(name)}`,
        ),
      this.results.deletionCheck,
      options?.analyse,
    );
  }

  delete<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        deleteMetadataExtension(
          connection,
          options.headers,
          name,
          config.transportRequest,
        ),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  activate<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>>;
  activate(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['activation'], IAdtError>>;
  async activate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        activateMetadataExtension(
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
  check<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  check(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  async check<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkMetadataExtension(connection, options.headers, name, version),
      this.results.check,
      options?.analyse,
    );
  }

  /**
   * Lock the object — one LOCK, its handle read by `lockHandleOf`. A 200
   * carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  lock<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
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
  unlock<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          const unlocked = await unlockMetadataExtension(
            this.connection,
            name,
            lockHandle,
          );
          // The registry records SAP's state, not the caller's verdict: the lock
          // leaves it only when SAP answered the UNLOCK with a 2xx, before any
          // `analyse` runs; a refused or unanswered one may leave it held.
          if (!failedWireStatus(unlocked)) this.lockTracker.untrack(name);
          return unlocked;
        } finally {
          this.connection.setSessionType('stateless');
        }
      },
      nothing,
      options?.analyse,
    );
  }

  /** Version history of the object's source. */
  getVersions<E extends IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>>;
  getVersions(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versions'], IAdtError>>;
  async getVersions<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMetadataExtensionConfig, 'name'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>> {
    return answering(
      () => getMetadataExtensionVersions(this.connection, config),
      this.results.versions,
      options?.analyse,
    );
  }

  /** Source of one version, by the `contentUri` its entry carried. */
  getVersionSource<E extends IAdtError>(
    contentUri: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versionSource'], E | IAdtError>>;
  getVersionSource(
    contentUri: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versionSource'], IAdtError>>;
  async getVersionSource<E extends IAdtError = IAdtError>(
    contentUri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versionSource'], E | IAdtError>> {
    return answering(
      () => getMetadataExtensionVersionSource(this.connection, contentUri),
      this.results.versionSource,
      options?.analyse,
    );
  }
}
