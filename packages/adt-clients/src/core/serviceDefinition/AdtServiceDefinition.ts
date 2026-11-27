/**
 * AdtServiceDefinition - CRUD for `SRVD/SRV` service definitions.
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
  IServiceDefinitionResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { SERVICE_DEFINITION } from '../../endpoints/objects';
import { answeringActivation } from '../../utils/activationUtils';
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
import { writeObjectDocument } from '../shared/documentWrite';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import { createLockTracker, type LockTracker } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateServiceDefinition } from './activation';
import { checkServiceDefinition } from './check';
import { create as createServiceDefinition } from './create';
import { checkDeletion, deleteServiceDefinition } from './delete';
import { lockServiceDefinition } from './lock';
import {
  getServiceDefinition,
  getServiceDefinitionSource,
  getServiceDefinitionTransport,
} from './read';
import type {
  IServiceDefinitionConfig,
  serviceDefinitionDocuments,
} from './types';
import { unlockServiceDefinition } from './unlock';
import { updateServiceDefinition } from './update';
import { validateServiceDefinitionName } from './validation';
import {
  getServiceDefinitionVersionSource,
  getServiceDefinitionVersions,
} from './versions';

/** What each slot of the result set answers. */
export type ServiceDefinitionValues = {
  readonly [K in keyof IServiceDefinitionResults]: unknown;
};

export class AdtServiceDefinition<
  T extends ServiceDefinitionValues = ResultValuesOf<
    typeof serviceDefinitionDocuments
  >,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtCreatable<IServiceDefinitionConfig, T['created']>,
    IAdtReadable<
      IServiceDefinitionConfig,
      T['source'],
      'serviceDefinitionName'
    >,
    IAdtMetadataReadable<
      IServiceDefinitionConfig,
      T['metadata'],
      'serviceDefinitionName'
    >,
    IAdtUpdatable<
      Partial<IServiceDefinitionConfig>,
      T['updated'],
      'serviceDefinitionName',
      'source'
    >,
    IAdtMetadataUpdatable<
      Partial<IServiceDefinitionConfig>,
      T['metadataUpdated'],
      'serviceDefinitionName',
      'source'
    >,
    IAdtDeletable<
      IServiceDefinitionConfig,
      T['deletion'],
      'serviceDefinitionName',
      T['deletionCheck']
    >,
    IAdtValidatable<
      IServiceDefinitionConfig,
      T['validation'],
      'serviceDefinitionName'
    >,
    IAdtCheckable<
      IServiceDefinitionConfig,
      T['check'],
      'serviceDefinitionName'
    >,
    IAdtActivatable<
      IServiceDefinitionConfig,
      T['activation'],
      'serviceDefinitionName'
    >,
    IAdtLockable<IServiceDefinitionConfig, 'serviceDefinitionName'>,
    IAdtTransportAware<
      IServiceDefinitionConfig,
      T['transport'],
      'serviceDefinitionName'
    >,
    IAdtVersionable<
      IServiceDefinitionConfig,
      T['versions'],
      T['versionSource'],
      'serviceDefinitionName'
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
  public readonly objectType: string = 'ServiceDefinition';

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
        unlockServiceDefinition(this.connection, name, lockHandle),
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
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
  ): string {
    return config.serviceDefinitionName;
  }

  /** Validate the name before creating the object. */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => validateServiceDefinitionName(connection, name, config.description),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the object. */
  create<E extends IAdtError>(
    config: Omit<IServiceDefinitionConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  create(
    config: Omit<IServiceDefinitionConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IServiceDefinitionConfig, 'source'> & {
      source?: never;
      packageName: string;
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
        createServiceDefinition(connection, options.headers, {
          service_definition_name: name,
          description: config.description,
          package_name: config.packageName,
          transport_request: config.transportRequest,
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
          masterLanguage: createLanguage(
            config.masterLanguage,
            this.systemContext.masterLanguage,
          ),
        }),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the object. */
  read<E extends IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    version: AdtReadVersion | undefined,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  read(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async read<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
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
      () => getServiceDefinitionSource(connection, name, version, options),
      this.results.source,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getServiceDefinition(connection, name, options?.version, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  readTransport<E extends IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  readTransport(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  async readTransport<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getServiceDefinitionTransport(connection, name, options),
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
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>>;
  update(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], IAdtError>>;
  async update<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
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
        updateServiceDefinition(
          connection,
          options.headers,
          options.ifMatch,
          {
            service_definition_name: name,
            source_code: source,
            transport_request: config.transportRequest,
          },
          options?.lockHandle,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Write the service definition's metadata document — one PUT of `options.source`,
   * as the caller built it, under the caller's `options.lockHandle` (and
   * `config.transportRequest` as `corrNr`), with the caller's headers.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`), change what you mean to change,
   * and pass the result: anything left out is gone, because nothing is read
   * here to keep it.
   */
  updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'serviceDefinition', 'updateMetadata'>,
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    this: this & AdtPerformedBy<'serviceDefinition', 'updateMetadata'>,
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'serviceDefinition', 'updateMetadata'>,
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
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
          SERVICE_DEFINITION.uri(this.name(config)),
          options?.source,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.metadataUpdated,
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
  checkDeletion<E extends IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  checkDeletion(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          service_definition_name: name,
          transport_request: config.transportRequest,
        }),
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
  delete<E extends IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        deleteServiceDefinition(connection, options.headers, {
          service_definition_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  activate<E extends IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>>;
  activate(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['activation'], IAdtError>>;
  async activate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answeringActivation(
      connection,
      (sent) =>
        activateServiceDefinition(
          sent,
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
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  check(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  async check<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkServiceDefinition(
          connection,
          options.headers,
          name,
          version,
          config.source,
        ),
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
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const name = this.name(config);
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockServiceDefinition(this.connection, name),
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
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const name = this.name(config);
    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockServiceDefinition(
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
  getVersions<E extends IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>>;
  getVersions(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versions'], IAdtError>>;
  async getVersions<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IServiceDefinitionConfig,
      'serviceDefinitionName'
    >,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>> {
    return answering(
      () => getServiceDefinitionVersions(this.connection, config),
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
      () => getServiceDefinitionVersionSource(this.connection, contentUri),
      this.results.versionSource,
      options?.analyse,
    );
  }
}
