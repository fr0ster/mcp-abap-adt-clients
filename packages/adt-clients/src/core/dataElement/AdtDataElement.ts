/**
 * AdtDataElement - CRUD for `DTEL/DE` data elements.
 *
 * A data element is an XML-based entity: it has no source, `read` and
 * `readMetadata` fetch the same document, and `update` is a read-modify-write
 * of that XML.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */
import type {
  AdtObjectIdentity,
  AdtRequiredUpdateOptions,
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
  IAdtTransportAware,
  IAdtUpdateOptions,
  IAdtValidatable,
  IAnalyse,
  IDataElementResults,
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
import { createLanguage } from '../../utils/xml';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import {
  createLockTracker,
  failedWireStatus,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateDataElement } from './activation';
import { checkDataElement } from './check';
import { create as createDataElement } from './create';
import { checkDeletion, deleteDataElement } from './delete';
import { lockDataElement } from './lock';
import { getDataElement, getDataElementTransport } from './read';
import type { dataElementDocuments, IDataElementConfig } from './types';
import { unlockDataElement } from './unlock';
import { updateDataElement } from './update';
import { validateDataElementName } from './validation';

/** What each slot of the result set answers. */
export type DataElementValues = {
  readonly [K in keyof IDataElementResults]: unknown;
};

export class AdtDataElement<
  T extends DataElementValues = ResultValuesOf<typeof dataElementDocuments>,
> implements
    IAdtCreatable<IDataElementConfig, T['created']>,
    IAdtMetadataReadable<IDataElementConfig, T['metadata'], 'dataElementName'>,
    IAdtMetadataUpdatable<
      Partial<IDataElementConfig>,
      T['metadataUpdated'],
      'dataElementName',
      'source'
    >,
    IAdtDeletable<
      IDataElementConfig,
      T['deletion'],
      'dataElementName',
      T['deletionCheck']
    >,
    IAdtValidatable<IDataElementConfig, T['validation'], 'dataElementName'>,
    IAdtCheckable<IDataElementConfig, T['check'], 'dataElementName'>,
    IAdtActivatable<IDataElementConfig, T['activation'], 'dataElementName'>,
    IAdtLockable<IDataElementConfig, 'dataElementName'>,
    IAdtTransportAware<IDataElementConfig, T['transport'], 'dataElementName'>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'DataElement';

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
        unlockDataElement(this.connection, name, lockHandle),
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
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
  ): string {
    return config.dataElementName;
  }

  /** Validate the name before creating the object. */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    // The endpoint refuses an empty one, so this is a caller error rather than a
    // 400 to decode later.

    return answering(
      () =>
        validateDataElementName(
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
    config: Omit<IDataElementConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  create(
    config: Omit<IDataElementConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IDataElementConfig, 'source'> & {
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
        createDataElement(connection, options.headers, {
          data_element_name: name,
          package_name: config.packageName,
          description: config.description,
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

  /** Read the object's metadata document. */
  readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getDataElement(connection, name, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  readTransport<E extends IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  readTransport(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  async readTransport<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getDataElementTransport(connection, name, options),
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
  updateMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        updateDataElement(
          connection,
          options.headers,
          options.ifMatch,
          {
            data_element_name: name,
            transport_request: config.transportRequest,
          },
          // The document the caller built, from the options — see
          // `AdtDomain.updateMetadata` for why that is the only channel. The fields
          // beside it describe a create; on an update nothing merges them into
          // a body here.
          options?.source,
          options?.lockHandle,
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
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  checkDeletion(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          data_element_name: name,
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
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        deleteDataElement(connection, options.headers, {
          data_element_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  activate<E extends IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>>;
  activate(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['activation'], IAdtError>>;
  async activate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        activateDataElement(
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
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  check(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  async check<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkDataElement(connection, options.headers, name, version),
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
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const name = this.name(config);
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockDataElement(this.connection, name),
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
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IDataElementConfig, 'dataElementName'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const name = this.name(config);
    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          const unlocked = await unlockDataElement(
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
