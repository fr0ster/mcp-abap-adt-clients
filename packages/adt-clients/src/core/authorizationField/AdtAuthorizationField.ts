/**
 * AdtAuthorizationField - CRUD for `AUTH` authorization fields.
 *
 * An XML-based object: no source, so `read` and `readMetadata` fetch the same
 * document and `update` writes that XML.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */
import type {
  AdtObjectIdentity,
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
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdateOptions,
  IAdtValidatable,
  IAnalyse,
  IAuthorizationFieldResults,
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
import {
  createLockTracker,
  failedWireStatus,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateAuthorizationField } from './activation';
import { checkAuthorizationField } from './check';
import { create as createAuthorizationField } from './create';
import { checkDeletion, deleteAuthorizationField } from './delete';
import { lockAuthorizationField } from './lock';
import { readAuthorizationField } from './read';
import type {
  authorizationFieldDocuments,
  IAuthorizationFieldConfig,
} from './types';
import { unlockAuthorizationField } from './unlock';
import { updateAuthorizationField } from './update';
import { validateAuthorizationFieldName } from './validation';

/** What each slot of the result set answers. */
export type AuthorizationFieldValues = {
  readonly [K in keyof IAuthorizationFieldResults]: unknown;
};

export class AdtAuthorizationField<
  T extends AuthorizationFieldValues = ResultValuesOf<
    typeof authorizationFieldDocuments
  >,
> implements
    IAdtCreatable<IAuthorizationFieldConfig, T['created']>,
    IAdtMetadataReadable<
      IAuthorizationFieldConfig,
      T['metadata'],
      'authorizationFieldName'
    >,
    IAdtMetadataUpdatable<
      Partial<IAuthorizationFieldConfig>,
      T['metadataUpdated'],
      'authorizationFieldName'
    >,
    IAdtDeletable<
      IAuthorizationFieldConfig,
      T['deletion'],
      'authorizationFieldName',
      T['deletionCheck']
    >,
    IAdtValidatable<
      IAuthorizationFieldConfig,
      T['validation'],
      'authorizationFieldName'
    >,
    IAdtCheckable<
      IAuthorizationFieldConfig,
      T['check'],
      'authorizationFieldName'
    >,
    IAdtActivatable<
      IAuthorizationFieldConfig,
      T['activation'],
      'authorizationFieldName'
    >,
    IAdtLockable<IAuthorizationFieldConfig, 'authorizationFieldName'>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'AuthorizationField';

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
        unlockAuthorizationField(this.connection, name, lockHandle),
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
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
  ): string {
    return config.authorizationFieldName;
  }

  /** Validate the name before creating the object. */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    // The endpoint refuses an empty one, so this is a caller error rather than
    // a 400 to decode later.

    return answering(
      () =>
        validateAuthorizationFieldName(
          connection,
          name,
          config.description,
          config.packageName,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the object. */
  create<E extends IAdtError>(
    config: Omit<IAuthorizationFieldConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  create(
    config: Omit<IAuthorizationFieldConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IAuthorizationFieldConfig, 'source'> & {
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
        createAuthorizationField(connection, options.headers, {
          authorization_field_name: name,
          description: config.description,
          package_name: config.packageName ?? '',
          transport_request: config.transportRequest,
          master_system: config.masterSystem ?? this.systemContext.masterSystem,
          responsible: config.responsible ?? this.systemContext.responsible,
          field_name: config.fieldName,
          roll_name: config.rollName,
          check_table: config.checkTable,
          exit_fb: config.exitFb,
          abap_language_version: config.abapLanguageVersion,
          search: config.search,
          objexit: config.objexit,
          domname: config.domname,
          outputlen: config.outputlen,
          convexit: config.convexit,
          orglvlinfo: config.orglvlinfo,
        }),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => readAuthorizationField(connection, name, options?.version, options),
      this.results.metadata,
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
  updateMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> & IAdtLockedWrite,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        updateAuthorizationField(
          connection,
          options.headers,
          options.ifMatch,
          {
            authorization_field_name: name,
            description: config.description,
            package_name: config.packageName ?? '',
            transport_request: config.transportRequest,
            master_system:
              config.masterSystem ?? this.systemContext.masterSystem,
            responsible: config.responsible ?? this.systemContext.responsible,
            field_name: config.fieldName,
            roll_name: config.rollName,
            check_table: config.checkTable,
            exit_fb: config.exitFb,
            abap_language_version: config.abapLanguageVersion,
            search: config.search,
            objexit: config.objexit,
            domname: config.domname,
            outputlen: config.outputlen,
            convexit: config.convexit,
            orglvlinfo: config.orglvlinfo,
          },
          options?.lockHandle,
          this.logger,
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
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  checkDeletion(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          authorization_field_name: name,
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
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        deleteAuthorizationField(connection, options.headers, {
          authorization_field_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  activate<E extends IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>>;
  activate(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['activation'], IAdtError>>;
  async activate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        activateAuthorizationField(
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
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  check(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  async check<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
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
      () => checkAuthorizationField(connection, options.headers, name, version),
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
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const name = this.name(config);
    return answering(
      async () => {
        const locked = await inStatefulSession(this.connection, () =>
          lockAuthorizationField(this.connection, name),
        );
        // The registry records SAP's state, not the caller's verdict: a lock
        // SAP granted (a 2xx carrying a handle) is recorded here, before any
        // `analyse` runs, so one it reports as a failure, or throws over, is
        // still released by `unlockAll`.
        const handle = lockHandleOf(locked);
        if (!failedWireStatus(locked) && handle) {
          this.lockTracker.track(name, handle);
        }
        return locked;
      },
      lockHandleOf,
      options?.analyse,
    );
  }

  /** Unlock the object. */
  unlock<E extends IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
    >,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<
      IAuthorizationFieldConfig,
      'authorizationFieldName'
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
          const unlocked = await unlockAuthorizationField(
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
}
