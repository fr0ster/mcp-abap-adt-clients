/**
 * AdtPackage - CRUD for `DEVC/K` packages.
 *
 * A package is a **container**: it has no source, so `read` and `readMetadata`
 * fetch the same document and there is no activation.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 *
 * Operation chains:
 * - Create: validate → create → check
 * - Update: lock → check → update → unlock
 * - Delete: check(deletion) → delete
 */

import type {
  IAdtAnalyseOptions,
  IAdtCheckable,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtValidatable,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import { nothing } from '../../utils/resultStrategy';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { checkPackage } from './check';
import { createPackage } from './create';
import { checkPackageDeletion, deletePackage } from './delete';
import { lockPackage } from './lock';
import { getPackage, getPackageTransport } from './read';
import {
  type IPackageConfig,
  type IPackageResults,
  packageDocuments,
} from './types';
import { unlockPackage } from './unlock';
import { updatePackage } from './update';
import { validatePackageBasic } from './validation';

export class AdtPackage<R extends IPackageResults = typeof packageDocuments>
  implements
    IAdtCreatable<IPackageConfig, ReturnType<R['created']>>,
    IAdtMetadataReadable<IPackageConfig, ReturnType<R['metadata']>>,
    IAdtMetadataUpdatable<
      Partial<IPackageConfig>,
      ReturnType<R['metadataUpdated']>
    >,
    IAdtDeletable<
      IPackageConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IPackageConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IPackageConfig, ReturnType<R['check']>>,
    IAdtLockable<IPackageConfig>,
    IAdtTransportAware<IPackageConfig, ReturnType<R['transport']>>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Package';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default. See AdtClass.
    protected readonly results: R = packageDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) => unlockPackage(this.connection, name, lockHandle),
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
  private name(config: Partial<IPackageConfig>): string {
    return config.packageName as string;
  }

  /** Validate the package's configuration before creating it. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IPackageConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        validatePackageBasic(connection, {
          package_name: name,
          super_package: config.superPackage as string,
          description: config.description,
          package_type: config.packageType,
          software_component: config.softwareComponent,
          transport_layer: config.transportLayer,
          transport_request: config.transportRequest,
          application_component: config.applicationComponent,
          responsible: config.responsible,
          record_changes: config.recordChanges ?? false,
        }),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /**
   * Create the package: validate → create → check.
   *
   * The check is a checkrun on the new object, the way Eclipse does it, not a
   * second call to the validation endpoint — captured 2026-08-31, which
   * validates, creates, then posts `/sap/bc/adt/checkruns` on the created
   * package before it is ever locked.
   */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IPackageConfig, 'source'> & { source?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // **No guard here, unlike every other create.**
    //
    // Elsewhere `packageName` is the package an object is bound to, and an
    // object created without one cannot be removed through ADT — that is the
    // one hazard this package guards. For a package it is the package's own
    // name; what binds it is `superPackage`, and a top-level package has none
    // by design. There is no field here whose absence traps anything.

    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        createPackage(connection, {
          package_name: name,
          super_package: config.superPackage as string,
          description: config.description,
          package_type: config.packageType,
          software_component: config.softwareComponent,
          transport_layer: config.transportLayer,
          transport_request: config.transportRequest,
          application_component: config.applicationComponent,
          responsible: config.responsible ?? this.systemContext.responsible,
          master_system: this.systemContext.masterSystem,
          master_language:
            config.masterLanguage?.trim() ||
            this.systemContext.masterLanguage?.trim() ||
            undefined,
          record_changes: config.recordChanges ?? false,
        }),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** The same document `read` fetches — a package has no second resource. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IPackageConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        getPackage(
          connection,
          name,
          options?.version ?? 'active',
          options,
          this.logger,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the package belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IPackageConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getPackageTransport(connection, name, options),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /**
   * Update the package's metadata.
   *
   * **One save per ABAP session** (issue #176). A session that has created or
   * updated a package cannot update it again: the PUT answers 400
   * `ExceptionResourceAlreadyExists`, PAK/058, "Package … is already locked".
   * The handle is not the cause — a made-up one answers 423
   * `SADT_RESOURCE/026`, ours is accepted — and neither is the enqueue lock.
   * `CL_PACKAGE` keeps each package instance in a static buffer for the whole
   * ABAP session, the create and the update both leave it in state
   * `requested`, and the next save loads it back from that buffer and
   * `set_changeable` refuses. Over RFC every call shares one session, so an
   * update straight after a create fails; over HTTP the create is stateless
   * and the update succeeds. Measured on an on-premise system 2026-09-26, both transports.
   *
   * Nothing here opens a new session to get round it — that is the caller's,
   * on the connection it owns. See docs/development/RFC_TESTING.md.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IPackageConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadataUpdated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const superPackage = config.superPackage as string;
    const softwareComponent = config.softwareComponent;

    const fields = {
      package_name: name,
      super_package: superPackage,
      software_component: softwareComponent,
      transport_layer: config.transportLayer,
      description: config.description,
      package_type: config.packageType,
      responsible: config.responsible,
      record_changes: config.recordChanges ?? false,
      // **Without this the request never reaches the URL.** `updatePackage`
      // appends `corrNr` when it is given one, and this field was the only
      // thing missing between a caller's `transportRequest` and that query
      // parameter. A local package never noticed; a package that records
      // changes refuses the PUT outright — measured against an on-premise
      // system, 2026-09-21: `400 SADT_RESOURCE 017`, "Parameter corrNr could
      // not be found."
      transport_request: config.transportRequest,
    };

    return answering(
      () =>
        updatePackage(
          connection,
          fields,
          // The document the caller built, from the options — see
          // `AdtDomain.updateMetadata`; the fields above describe a create.
          options?.source as string,
          options?.lockHandle as string,
        ),
      this.results.metadataUpdated as IResultStrategy<
        ReturnType<R['metadataUpdated']>
      >,
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
    config: Partial<IPackageConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        checkPackageDeletion(connection, {
          package_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
  }

  /**
   * Delete the package.
   *
   * A package this session has just updated cannot be deleted by this session —
   * measured 2026-08-31: `deletion/check` answers `isDeletable="true"`
   * while `deletion/delete` answers HTTP 200 carrying `isDeleted="false"` and
   * PAK/058, "package is already locked", even though the UNLOCK moments
   * earlier answered 200. It is not a delay: retried for 30 seconds inside the
   * run it never succeeds, and the same request one second after the run ends
   * deletes it on the first attempt. It is `CL_PACKAGE`'s session buffer
   * (issue #176): the update left the package's instance there as `requested`,
   * and the delete loads it back and is refused. A new session has no such
   * instance.
   *
   * The answer is a 200 either way, and `isDeleted="false"` is in its body: a
   * caller who wants that read as a failure passes `analyseDeletion` (from
   * `@mcp-abap-adt/adt-strategies`) — this member reads nothing into it, and it
   * does not wait for something that cannot happen while the caller still holds
   * the session. `IAbapConnection` has no `disconnect` and no `recycle`, and
   * should not: the connection belongs to the caller and is usually shared, so
   * tearing it down mid-operation would take every other user of it down as
   * well. Recycling is the consumer's call. See
   * docs/usage/STATEFUL_SESSION_GUIDE.md.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IPackageConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        deletePackage(connection, {
          package_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Check the package. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IPackageConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkPackage(connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /**
   * Lock the package — one LOCK, its handle read by `lockHandleOf`. A 200
   * carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<IPackageConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const name = this.name(config);
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockPackage(this.connection, name),
        ),
      lockHandleOf,
      options?.analyse,
    );
    if (answer.ok && answer.getResult().value) {
      this.lockTracker.track(name, answer.getResult().value);
    }
    return answer;
  }

  /** Unlock the package. */
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<IPackageConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockPackage(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      nothing,
      options?.analyse,
    );
  }
}
