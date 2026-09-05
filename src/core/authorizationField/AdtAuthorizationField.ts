/**
 * AdtAuthorizationField - CRUD for `SUSO/O` authorization fields.
 *
 * An XML-based object: no source, so `read` and `readMetadata` fetch the same
 * document and `update` writes that XML.
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
import { activationRefusal } from '../../utils/activationUtils';
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
import { activateAuthorizationField } from './activation';
import { checkAuthorizationField } from './check';
import { create as createAuthorizationField } from './create';
import { checkDeletion, deleteAuthorizationField } from './delete';
import { lockAuthorizationField } from './lock';
import { readAuthorizationField } from './read';
import {
  authorizationFieldDocuments,
  type IAuthorizationFieldConfig,
  type IAuthorizationFieldResults,
} from './types';
import { unlockAuthorizationField } from './unlock';
import { updateAuthorizationField } from './update';
import { validateAuthorizationFieldName } from './validation';

export class AdtAuthorizationField<
  R extends IAuthorizationFieldResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IAuthorizationFieldResults,
> implements
    IAdtCreatable<IAuthorizationFieldConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IAuthorizationFieldConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IAuthorizationFieldConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IAuthorizationFieldConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IAuthorizationFieldConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IAuthorizationFieldConfig, ReturnType<R['check']>>,
    IAdtActivatable<IAuthorizationFieldConfig, ReturnType<R['activation']>>,
    IAdtLockable<IAuthorizationFieldConfig>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'AuthorizationField';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = authorizationFieldDocuments as unknown as R,
  ) {
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

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IAuthorizationFieldConfig>): string {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }
    return config.authorizationFieldName;
  }

  /** Validate the name before creating the object. */
  async validate(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
    const name = this.name(config);
    // The endpoint refuses an empty one, so this is a caller error rather than
    // a 400 to decode later.
    if (!config.description) {
      throw new Error('Description is required for validation');
    }

    return answering(
      () =>
        validateAuthorizationFieldName(
          this.connection,
          name,
          config.description as string,
          config.packageName,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the object. */
  async create(
    config: IAuthorizationFieldConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting authorization field after failure');
          await deleteAuthorizationField(this.connection, {
            authorization_field_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Creating authorization field');
      const value = await step(
        answering(
          () =>
            createAuthorizationField(this.connection, {
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
            }),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      // Only past the step: a refused create leaves nothing to delete, and the
      // cleanup above must not remove an object this call did not make.
      created = true;
      this.logger?.info?.('Authorization field created');
      return value;
    });
  }

  /** Read the object.
   *
   * `version` is passed through; the field is XML-based and has one document. */
  async read(
    config: Partial<IAuthorizationFieldConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () =>
        readAuthorizationField(
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
  async readMetadata(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () =>
        readAuthorizationField(
          this.connection,
          name,
          options?.version ?? 'active',
          options,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
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
  async update(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }
    const source = options?.xmlContent;

    if (options?.lockHandle) {
      const lockHandle = options.lockHandle;
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          updateAuthorizationField(
            this.connection,
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
            lockHandle,
            this.logger,
          ),
        this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
        options?.analyse,
      );
    }

    // A LOCK…UNLOCK window: a timeout in the middle releases the lock and
    // leaves the work half done, so the connection is told this is critical.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Step 1: Locking authorization field');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: on older BASIS a lock handle is
      // only valid inside a stateful request, so going stateless before the
      // unlock would break the unlock (#106); and if the lock itself throws,
      // the session is still restored.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockAuthorizationField(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockAuthorizationField(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Authorization field locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () => checkAuthorizationField(this.connection, name, 'inactive'),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      // Always written: the fields come from the config, not from a
      // source string a caller may or may not have passed, so there is
      // nothing to skip and nothing to leave undefined.
      this.logger?.info?.('Step 3: Updating authorization field');
      const updated = await step(
        answering(
          () =>
            updateAuthorizationField(
              this.connection,
              {
                authorization_field_name: name,
                description: config.description,
                package_name: config.packageName ?? '',
                transport_request: config.transportRequest,
                master_system:
                  config.masterSystem ?? this.systemContext.masterSystem,
                responsible:
                  config.responsible ?? this.systemContext.responsible,
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
              lockHandle,
              this.logger,
            ),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Authorization field updated');

      // The write produced the inactive version, and that is the one polled:
      // the active one still holds the pre-update content, so waiting on it
      // returns something the update cannot have changed. A failure here is not
      // the update's failure, so it is logged and the chain continues — the
      // unlock still has to happen.
      const ready = await this.read(config, 'inactive', {
        withLongPolling: true,
      });
      if (!ready.ok) {
        this.logger?.warn?.(
          'read with long polling failed after update:',
          ready.getError().message,
        );
      }

      this.logger?.info?.('Step 4: Unlocking authorization field');
      this.connection.setSessionType('stateful');
      await unlockAuthorizationField(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();
      this.logger?.info?.('Authorization field unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () => checkAuthorizationField(this.connection, name, 'inactive'),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating authorization field');
        await step(
          answering(
            () => activateAuthorizationField(this.connection, name),
            this.results.activation as IResultStrategy<
              ReturnType<R['activation']>
            >,
            options?.analyse ?? activationRefusal,
          ),
        );

        const ready = await this.read(config, 'active', {
          withLongPolling: true,
        });
        if (!ready.ok) {
          this.logger?.warn?.(
            'read with long polling failed after activation:',
            ready.getError().message,
          );
        }
      }

      return updated;
    });
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
  async delete(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking authorization field for deletion');
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              authorization_field_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse ?? deletionRefusal,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting authorization field');
      const value = await step(
        answering(
          () =>
            deleteAuthorizationField(this.connection, {
              authorization_field_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Authorization field deleted');
      return value;
    });
  }

  /** Activate the object. Needs no stateful session. */
  async activate(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    const name = this.name(config);

    return answering(
      () => activateAuthorizationField(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse ?? activationRefusal,
    );
  }

  /** Check the object. */
  async check(
    config: Partial<IAuthorizationFieldConfig>,
    status?: string,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['check']>>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkAuthorizationField(this.connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IAuthorizationFieldConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockAuthorizationField(this.connection, name);
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
    config: Partial<IAuthorizationFieldConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockAuthorizationField(
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
}
