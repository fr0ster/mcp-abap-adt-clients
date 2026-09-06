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
  IAnalyse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../utils/activationUtils';
import { answering } from '../../utils/adtResponse';
import { deletionRefusal } from '../../utils/deletionCheck';
import { validationRefusal } from '../../utils/validationRefusal';
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
    options?: IAdtOperationOptions<E>,
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
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: IDomainConfig,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    return answering(
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
    );
  }

  /** Read the object.
   *
   * `version` is accepted and ignored: a domain is XML-based and has one
   * document, not an active/inactive source pair. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    _version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
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
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const name = this.name(config);

    return answering(
      () => getDomain(this.connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
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
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }

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
          options?.lockHandle,
        ),
      this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
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
    config: Partial<IDomainConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(this.connection, {
          domain_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
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
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        deleteDomain(this.connection, {
          domain_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: IAdtOperationOptions<E>,
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
    options?: IAdtOperationOptions<E>,
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
