/**
 * AdtDomain - CRUD for `DOMA/DD` domains.
 *
 * A domain is an XML-based entity: it has no source, `read` and `readMetadata`
 * fetch the same document, and `update` is a read-modify-write of that XML.
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
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../utils/activationUtils';
import {
  answering,
  type IAdtOptions,
  type IAnalyse,
} from '../../utils/adtResponse';
import { beginCriticalSection } from '../../utils/criticalSection';
import { deletionRefusal } from '../../utils/deletionCheck';
import { chain } from '../shared/chain';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateDomain } from './activation';
import { checkDomainSyntax } from './check';
import { create as createDomain } from './create';
import { checkDeletion, deleteDomain } from './delete';
import { lockDomain } from './lock';
import { getDomain, getDomainTransport } from './read';
import {
  domainDocuments,
  type IDomainConfig,
  type IDomainResults,
} from './types';
import { unlockDomain } from './unlock';
import { updateDomain } from './update';
import { validateDomainName } from './validation';

export class AdtDomain<
  R extends IDomainResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IDomainResults,
> implements
    IAdtCreatable<IDomainConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IDomainConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IDomainConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IDomainConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IDomainConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IDomainConfig, ReturnType<R['check']>>,
    IAdtActivatable<IDomainConfig, ReturnType<R['activation']>>,
    IAdtLockable<IDomainConfig>,
    IAdtTransportAware<IDomainConfig, ReturnType<R['transport']>>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Domain';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = domainDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) => unlockDomain(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IDomainConfig>): string {
    if (!config.domainName) {
      throw new Error('Domain name is required');
    }
    return config.domainName;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);
    // The endpoint refuses an empty one, so this is a caller error rather than a
    // 400 to decode later.
    if (!config.description) {
      throw new Error('Description is required for validation');
    }

    return answering(
      () =>
        validateDomainName(
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
  async create<E extends IAdtError = IAdtError>(
    config: IDomainConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
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
          this.logger?.warn?.('Deleting domain after failure');
          await deleteDomain(this.connection, {
            domain_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Creating domain');
      const value = await step(
        answering(
          () =>
            createDomain(this.connection, {
              domain_name: name,
              package_name: config.packageName as string,
              transport_request: config.transportRequest,
              description: config.description as string,
              datatype: config.datatype,
              length: config.length,
              decimals: config.decimals,
              conversion_exit: config.conversion_exit,
              lowercase: config.lowercase,
              sign_exists: config.sign_exists,
              value_table: config.value_table,
              fixed_values: config.fixed_values,
              masterSystem: this.systemContext.masterSystem,
              responsible: this.systemContext.responsible,
              masterLanguage:
                config.masterLanguage ?? this.systemContext.masterLanguage,
            }),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      // Only past the step: a refused create leaves nothing to delete, and the
      // cleanup above must not remove an object this call did not make.
      created = true;
      this.logger?.info?.('Domain created');
      return value;
    });
  }

  /** Read the object.
   *
   * `version` is accepted and ignored: a domain is XML-based and has one
   * document, not an active/inactive source pair. */
  async read(
    config: Partial<IDomainConfig>,
    _version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () => getDomain(this.connection, name, options),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata(
    config: Partial<IDomainConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () => getDomain(this.connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport(
    config: Partial<IDomainConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['transport']>>> {
    const name = this.name(config);

    return answering(
      () => getDomainTransport(this.connection, name, options),
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
    config: Partial<IDomainConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
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
          updateDomain(
            this.connection,
            {
              domain_name: name,
              package_name: config.packageName as string,
              transport_request: config.transportRequest,
              description: config.description,
              datatype: config.datatype,
              length: config.length,
              decimals: config.decimals,
              conversion_exit: config.conversion_exit,
              lowercase: config.lowercase,
              sign_exists: config.sign_exists,
              value_table: config.value_table,
              fixed_values: config.fixed_values,
              masterSystem: this.systemContext.masterSystem,
              responsible: this.systemContext.responsible,
            },
            lockHandle,
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

      this.logger?.info?.('Step 1: Locking domain');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: on older BASIS a lock handle is
      // only valid inside a stateful request, so going stateless before the
      // unlock would break the unlock (#106); and if the lock itself throws,
      // the session is still restored.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockDomain(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockDomain(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Domain locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () =>
              checkDomainSyntax(
                this.connection,
                name,
                'inactive',
                source,
                this.logger,
              ),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      // Always written: the fields come from the config, not from a
      // source string a caller may or may not have passed, so there is
      // nothing to skip and nothing to leave undefined.
      this.logger?.info?.('Step 3: Updating domain');
      const updated = await step(
        answering(
          () =>
            updateDomain(
              this.connection,
              {
                domain_name: name,
                package_name: config.packageName as string,
                transport_request: config.transportRequest,
                description: config.description,
                datatype: config.datatype,
                length: config.length,
                decimals: config.decimals,
                conversion_exit: config.conversion_exit,
                lowercase: config.lowercase,
                sign_exists: config.sign_exists,
                value_table: config.value_table,
                fixed_values: config.fixed_values,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
              },
              lockHandle,
            ),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Domain updated');

      // The write produced the inactive version; the active one may not exist
      // yet. A failure here is not the update's failure, so it is logged and
      // the chain continues — the unlock still has to happen.
      const ready = await this.read(config, 'active', {
        withLongPolling: true,
      });
      if (!ready.ok) {
        this.logger?.warn?.(
          'read with long polling failed after update:',
          ready.getError().message,
        );
      }

      this.logger?.info?.('Step 4: Unlocking domain');
      this.connection.setSessionType('stateful');
      await unlockDomain(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();
      this.logger?.info?.('Domain unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () =>
            checkDomainSyntax(
              this.connection,
              name,
              'inactive',
              undefined,
              this.logger,
            ),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating domain');
        await step(
          answering(
            () => activateDomain(this.connection, name),
            this.results.activation as IResultStrategy<
              ReturnType<R['activation']>
            >,
            (options?.analyse ?? activationRefusal) as IAnalyse<E>,
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
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking domain for deletion');
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              domain_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting domain');
      const value = await step(
        answering(
          () =>
            deleteDomain(this.connection, {
              domain_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Domain deleted');
      return value;
    });
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const name = this.name(config);

    return answering(
      () => activateDomain(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    status?: string,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkDomainSyntax(
          this.connection,
          name,
          version,
          undefined,
          this.logger,
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(config: Partial<IDomainConfig>): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockDomain(this.connection, name);
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
    config: Partial<IDomainConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockDomain(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      () => undefined,
    );
  }
}
