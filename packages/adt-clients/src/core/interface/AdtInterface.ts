import type {
  AdtReadVersion,
  AdtRequiredUpdateOptions,
  IAdtLockedWrite,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
/**
 * AdtInterface - CRUD for `INTF/OI` interfaces.
 *
 * Every member answers `IAdtResponse<T>`, where T is whatever the result set
 * given at construction makes of that endpoint's answer. What runs before the
 * member's own request — a lock, a check — is this implementation's business
 * and is not in the answer: only its failures are.
 *
 * Operation chains:
 * - Create: create
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import type {
  AdtObjectIdentity,
  AdtVariant,
  IAdtActivatable,
  IAdtActivationOptions,
  IAdtAnalyseOptions,
  IAdtCheckable,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtHeaders,
  IAdtLockable,
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
  IInterfaceResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { INTERFACE } from '../../endpoints/objects';
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
import {
  createLockTracker,
  failedWireStatus,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateInterface } from './activation';
import { checkInterface } from './check';
import { create as createInterface } from './create';
import { checkDeletion, deleteInterface } from './delete';
import { lockInterface } from './lock';
import {
  getInterfaceMetadata,
  getInterfaceSource,
  getInterfaceTransport,
} from './read';
import type { IInterfaceConfig, interfaceDocuments } from './types';
import { unlockInterface } from './unlock';
import { upload } from './update';
import { validateInterfaceName } from './validation';
import { getInterfaceVersionSource, getInterfaceVersions } from './versions';

/** What each slot of the result set answers. */
export type InterfaceValues = {
  readonly [K in keyof IInterfaceResults]: unknown;
};

export class AdtInterface<
  T extends InterfaceValues = ResultValuesOf<typeof interfaceDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtCreatable<IInterfaceConfig, T['created']>,
    IAdtReadable<IInterfaceConfig, T['source'], 'interfaceName'>,
    IAdtMetadataReadable<IInterfaceConfig, T['metadata'], 'interfaceName'>,
    IAdtUpdatable<
      Partial<IInterfaceConfig>,
      T['updated'],
      'interfaceName',
      'source'
    >,
    IAdtMetadataUpdatable<
      Partial<IInterfaceConfig>,
      T['metadataUpdated'],
      'interfaceName',
      'source'
    >,
    IAdtDeletable<
      IInterfaceConfig,
      T['deletion'],
      'interfaceName',
      T['deletionCheck']
    >,
    IAdtValidatable<IInterfaceConfig, T['validation'], 'interfaceName'>,
    IAdtCheckable<IInterfaceConfig, T['check'], 'interfaceName'>,
    IAdtActivatable<IInterfaceConfig, T['activation'], 'interfaceName'>,
    IAdtLockable<IInterfaceConfig, 'interfaceName'>,
    IAdtTransportAware<IInterfaceConfig, T['transport'], 'interfaceName'>,
    IAdtVersionable<
      IInterfaceConfig,
      T['versions'],
      T['versionSource'],
      'interfaceName'
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
  protected readonly contentTypes?: IAdtContentTypes;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Interface';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'systemContext' | 'contentTypes' | 'lockRegistry'
    >,
  ) {
    const { logger, systemContext, contentTypes, lockRegistry } = options;
    this.results = options.results;
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.contentTypes = contentTypes;
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (interfaceName, lockHandle) =>
        unlockInterface(this.connection, interfaceName, lockHandle),
    );
  }

  /** Validate an interface name before creating it. */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        validateInterfaceName(
          connection,
          config.interfaceName,
          config.packageName ?? '',
          config.description,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the interface. */
  create<E extends IAdtError>(
    config: Omit<IInterfaceConfig, 'source'> & {
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
    config: Omit<IInterfaceConfig, 'source'> & {
      source?: never;
      packageName: string;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IInterfaceConfig, 'source'> & {
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

    const name = config.interfaceName;
    return answering(
      () =>
        createInterface(
          connection,
          options.headers,
          {
            interfaceName: name,
            packageName: config.packageName,
            transportRequest: config.transportRequest,
            description: config.description,
            masterSystem: this.systemContext.masterSystem,
            responsible: this.systemContext.responsible,
            masterLanguage: createLanguage(
              config.masterLanguage,
              this.systemContext.masterLanguage,
            ),
          },
          this.logger,
        ),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the interface's source. */
  read<E extends IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    version: AdtReadVersion | undefined,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  read(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async read<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, and whether that *is* absence is the caller's reading.
    return answering(
      () =>
        getInterfaceSource(connection, config.interfaceName, version, options),
      this.results.source,
      options?.analyse,
    );
  }

  /** Read the interface's metadata. */
  readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () => getInterfaceMetadata(connection, config.interfaceName, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /**
   * Write the interface's source.
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
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>>;
  update(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], IAdtError>>;
  async update<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName;
    // The source is the caller's, through `options.source`. This used to
    // fall back to `config.source` — two channels for one value, where the
    // contract documents one. `config.source` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.source;

    return answering(
      () =>
        upload(
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

  /**
   * Write the interface's metadata document — one PUT of `options.source`, as
   * the caller built it, under the caller's `options.lockHandle` (and
   * `config.transportRequest` as `corrNr`), with the caller's headers.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`), change what you mean to change,
   * and pass the result: anything left out is gone, because nothing is read
   * here to keep it.
   */
  updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'interface', 'updateMetadata'>,
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    this: this & AdtPerformedBy<'interface', 'updateMetadata'>,
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'interface', 'updateMetadata'>,
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
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
          INTERFACE.uri(config.interfaceName),
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
    this: this & AdtPerformedBy<'interface', 'deletionCheck'>,
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  checkDeletion(
    this: this & AdtPerformedBy<'interface', 'deletionCheck'>,
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'interface', 'deletionCheck'>,
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName;
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          interface_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck,
      options?.analyse,
    );
  }

  /**
   * Delete the interface.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  delete<E extends IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName;
    return answering(
      () =>
        deleteInterface(connection, options.headers, {
          interface_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the interface. Needs no stateful session. */
  activate<E extends IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>>;
  activate(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['activation'], IAdtError>>;
  async activate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        activateInterface(
          connection,
          options.headers,
          config.interfaceName,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Check the interface. */
  check<E extends IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  check(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  async check<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkInterface(
          connection,
          options.headers,
          config.interfaceName,
          version,
          config.source,
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.check,
      options?.analyse,
    );
  }

  /** The transport request the interface belongs to. */
  readTransport<E extends IAdtError>(
    this: this & AdtPerformedBy<'interface', 'transport'>,
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  readTransport(
    this: this & AdtPerformedBy<'interface', 'transport'>,
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'interface', 'transport'>,
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getInterfaceTransport(
          connection,
          config.interfaceName,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport,
      options?.analyse,
    );
  }

  /**
   * Lock the interface — one LOCK, its handle read by `lockHandleOf`. A 200
   * carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  lock<E extends IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const name = config.interfaceName;
    return answering(
      async () => {
        const locked = await inStatefulSession(this.connection, () =>
          lockInterface(this.connection, name),
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

  /** Unlock the interface. */
  unlock<E extends IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const name = config.interfaceName;

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        const result = await inStatefulSession(this.connection, () =>
          unlockInterface(this.connection, name, lockHandle),
        );
        // The registry records SAP's state, not the caller's verdict: the lock
        // leaves it only when SAP answered the UNLOCK with a 2xx, before any
        // `analyse` runs; a refused or unanswered one may leave it held.
        if (!failedWireStatus(result)) this.lockTracker.untrack(name);
        return result;
      },
      nothing,
      options?.analyse,
    );
  }

  /** Version history of the interface's source. */
  getVersions<E extends IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>>;
  getVersions(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versions'], IAdtError>>;
  async getVersions<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IInterfaceConfig, 'interfaceName'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>> {
    return answering(
      () => getInterfaceVersions(this.connection, config),
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
      () => getInterfaceVersionSource(this.connection, contentUri),
      this.results.versionSource,
      options?.analyse,
    );
  }
}
