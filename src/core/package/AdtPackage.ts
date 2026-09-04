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
  IAbapConnection,
  IAdtCheckable,
  IAdtCreatable,
  IAdtDeletable,
  IAdtLockable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { deletionRefusal } from '../../utils/deletionCheck';
import { chain } from '../shared/chain';
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

export class AdtPackage<
  R extends IPackageResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IPackageResults,
> implements
    IAdtCreatable<IPackageConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IPackageConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IPackageConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IPackageConfig, ReturnType<R['deletion']>>,
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

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IPackageConfig>): string {
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    return config.packageName;
  }

  /** Validate the package's configuration before creating it. */
  async validate(
    config: Partial<IPackageConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
    const name = this.name(config);
    if (!config.superPackage) {
      throw new Error('Super package is required for validation');
    }

    return answering(
      () =>
        validatePackageBasic(this.connection, {
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
   * second call to the validation endpoint — captured on E19 2026-08-31, which
   * validates, creates, then posts `/sap/bc/adt/checkruns` on the created
   * package before it is ever locked.
   */
  async create(
    config: IPackageConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
    const name = this.name(config);
    if (!config.superPackage) {
      throw new Error('Super package is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.softwareComponent) {
      throw new Error('Software component is required');
    }
    if (!config.responsible && !this.systemContext.responsible) {
      throw new Error(
        'Responsible person is required: provide it in package config or in AdtClient options',
      );
    }

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onScopeEnd(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting package after failure');
          await deletePackage(this.connection, {
            package_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Step 1: Validating package configuration');
      await step(this.validate(config, options));

      this.logger?.info?.('Step 2: Creating package');
      const value = await step(
        answering(
          () =>
            createPackage(this.connection, {
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
        ),
      );
      created = true;
      this.logger?.info?.('Package created');

      // A readiness poll, not part of the answer.
      const ready = await this.read({ packageName: name }, 'active', {
        withLongPolling: true,
      });
      if (!ready.ok) {
        this.logger?.warn?.(
          'read with long polling failed after create:',
          ready.getError().message,
        );
      }

      // The check's own failure is returned, because the server's verdict on
      // the object it just made is worth surfacing rather than discovering at
      // the next operation. A check that cannot *run* is a different thing —
      // the object is there — and that is the error strategy's call, not a
      // reason to unmake it here.
      this.logger?.info?.('Step 3: Checking package');
      await step(this.check({ packageName: name }, 'active', options));

      return value;
    });
  }

  /**
   * Read the package.
   *
   * `version` is passed through, though a package has one document: the
   * endpoint accepts it and callers pass it.
   */
  async read(
    config: Partial<IPackageConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a package that is not there
    // with 200 and an empty body, and whether that *is* absence is the caller's
    // reading, supplied through `analyse`.
    return answering(
      () => getPackage(this.connection, name, version, options, this.logger),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** The same document `read` fetches — a package has no second resource. */
  async readMetadata(
    config: Partial<IPackageConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () =>
        getPackage(
          this.connection,
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
  async readTransport(
    config: Partial<IPackageConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['transport']>>> {
    const name = this.name(config);

    return answering(
      () => getPackageTransport(this.connection, name, options),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /**
   * Update the package's metadata.
   *
   * **Package update over RFC fails**, and not for the reason the old comment
   * gave. It said the PUT "cannot access the PAK lock created by the LOCK
   * call". Measured on E19 2026-08-31, that is wrong: the PUT reads the
   * parameter, validates the handle, and accepts ours. Four answers from the
   * same endpoint, same session, same package, over rfc:
   *
   *   PUT with no lockHandle     400  ExceptionParameterNotFound
   *                                   SADT_RESOURCE/017  "Parameter lockHandle
   *                                   could not be found"
   *   PUT with a made-up handle  423  ExceptionResourceInvalidLockHandle
   *                                   SADT_RESOURCE/026  "is not locked
   *                                   (invalid lock handle: DEADBEEF…)"
   *   a second _action=LOCK      403  ExceptionResourceNoAccess
   *                                   EU/510  "User … is currently editing"
   *   PUT with OUR handle        400  ExceptionResourceAlreadyExists
   *                                   PAK/058  "Package … is already locked"
   *
   * The first two say the lock handle is read and checked, and ours passes both
   * checks — a PUT that could not see the lock would answer 423, exactly as the
   * made-up handle does. The third says the ADT resource lock is ours and is
   * recognised as ours.
   *
   * So the refusal comes from a layer past the ADT lock. PAK is the package
   * framework's own message class, and PAK/058 is what it answers when its own
   * lock cannot be taken. That state does not survive the hop between internal
   * contexts that SADT_REST_RFC_ENDPOINT makes per call; the enqueue handle
   * does, which is why UNLOCK afterwards answers 200.
   *
   * It is packages alone. In the same rfc run 31 other updates pass — classes,
   * interfaces, domains, data elements, tables, structures, DDL, behaviour
   * definitions — and no PAK message appears anywhere else in the log. Not
   * critical for release: http is the primary transport for modern on-premise
   * systems, and rfc exists for BASIS < 7.50, where package CRUD is not
   * supported regardless.
   */
  async update(
    config: Partial<IPackageConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    const name = this.name(config);
    if (!config.superPackage) {
      throw new Error('Super package is required for update');
    }
    if (!config.softwareComponent) {
      throw new Error('Software component is required for update');
    }
    const superPackage = config.superPackage;
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
    };

    if (options?.lockHandle) {
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          updatePackage(this.connection, fields, options.lockHandle as string),
        this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
        options?.analyse,
      );
    }

    // A LOCK…UNLOCK window: a timeout in the middle releases the lock and
    // leaves the work half done.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Step 1: Locking package');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: stateful stays on until after the
      // unlock (#106).
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const { lockHandle } = await lockPackage(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockPackage(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Package locked, handle:', lockHandle);

      if (options?.xmlContent) {
        this.logger?.info?.('Step 2: Checking with update content');
        await step(this.check({ packageName: name }, 'inactive', options));
      }

      this.logger?.info?.('Step 3: Updating package');
      const updated = await step(
        answering(
          () => updatePackage(this.connection, fields, lockHandle),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );

      const ready = await this.read({ packageName: name }, 'inactive', {
        withLongPolling: true,
      });
      if (!ready.ok) {
        this.logger?.warn?.(
          'read with long polling failed after update:',
          ready.getError().message,
        );
      }

      this.logger?.info?.('Step 4: Unlocking package');
      this.connection.setSessionType('stateful');
      await unlockPackage(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      releaseLock();

      // No check or activate afterwards: a package has no source.
      return updated;
    });
  }

  /**
   * Delete the package.
   *
   * A package this session has just updated cannot be deleted by this session —
   * measured on E19 2026-08-31: `deletion/check` answers `isDeletable="true"`
   * while `deletion/delete` answers HTTP 200 carrying `isDeleted="false"` and
   * PAK/058, "package is already locked", even though the UNLOCK moments
   * earlier answered 200. It is not a delay: retried for 30 seconds inside the
   * run it never succeeds, and the same request one second after the run ends
   * deletes it on the first attempt. The PAK lock belongs to the ABAP session
   * and goes with it.
   *
   * So this reports the failure rather than waiting for something that cannot
   * happen while the caller still holds the session — and reporting is as far
   * as it can go. `IAbapConnection` has no `disconnect` and no `recycle`, and
   * should not: the connection belongs to the caller and is usually shared, so
   * tearing it down mid-operation would take every other user of it down as
   * well. Recycling is the consumer's call. See
   * docs/usage/STATEFUL_SESSION_GUIDE.md.
   */
  async delete(
    config: Partial<IPackageConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking package for deletion');
      await step(
        answering(
          () =>
            checkPackageDeletion(this.connection, {
              package_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse ?? deletionRefusal,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      this.logger?.info?.('Deleting package');
      const value = await step(
        answering(
          () =>
            deletePackage(this.connection, {
              package_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          // `isDeleted="false"` with PAK/058 arrives inside a 200, so the
          // document decides here as it does for the check.
          options?.analyse ?? deletionRefusal,
        ),
      );
      this.logger?.info?.('Package deleted');
      return value;
    });
  }

  /** Check the package. */
  async check(
    config: Partial<IPackageConfig>,
    status?: string,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['check']>>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkPackage(this.connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the package for modification. */
  async lock(config: Partial<IPackageConfig>): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const { lockHandle } = await lockPackage(this.connection, name);
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

  /** Unlock the package. */
  async unlock(
    config: Partial<IPackageConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
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
      () => undefined,
    );
  }
}
