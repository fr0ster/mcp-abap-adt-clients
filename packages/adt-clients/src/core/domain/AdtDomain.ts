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
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdateOptions,
  IAdtValidatable,
  IDomainResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
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
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import { createLockTracker, type LockTracker } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateDomain } from './activation';
import { checkDomainSyntax } from './check';
import { create as createDomain } from './create';
import { checkDeletion, deleteDomain } from './delete';
import { lockDomain } from './lock';
import { getDomain, getDomainTransport } from './read';
import type { domainDocuments, IDomainConfig } from './types';
import { unlockDomain } from './unlock';
import { updateDomain } from './update';
import { validateDomainName } from './validation';

/** What each slot of the result set answers. */
export type DomainValues = {
  readonly [K in keyof IDomainResults]: unknown;
};

export class AdtDomain<
  T extends DomainValues = ResultValuesOf<typeof domainDocuments>,
> implements
    IAdtCreatable<IDomainConfig, T['created']>,
    IAdtMetadataReadable<IDomainConfig, T['metadata']>,
    IAdtMetadataUpdatable<Partial<IDomainConfig>, T['metadataUpdated']>,
    IAdtDeletable<IDomainConfig, T['deletion'], T['deletionCheck']>,
    IAdtValidatable<IDomainConfig, T['validation']>,
    IAdtCheckable<IDomainConfig, T['check']>,
    IAdtActivatable<IDomainConfig, T['activation']>,
    IAdtLockable<IDomainConfig>,
    IAdtTransportAware<IDomainConfig, T['transport']>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Domain';

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
      (name, lockHandle) => unlockDomain(this.connection, name, lockHandle),
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
  private name(config: Partial<IDomainConfig>): string {
    return config.domainName as string;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    // The endpoint refuses an empty one, so this is a caller error rather than a
    // 400 to decode later.

    return answering(
      () =>
        validateDomainName(
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
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IDomainConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E>> {
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
        createDomain(connection, options.headers, {
          domain_name: name,
          package_name: config.packageName,
          transport_request: config.transportRequest,
          description: config.description as string,
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
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getDomain(connection, name, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getDomainTransport(connection, name, options),
      this.results.transport,
      options?.analyse,
    );
  }

  /**
   * Write the object.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain, so
   * this is one request. Without it, this locks, checks, writes and unlocks —
   * and the unlock happens on every path out.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    // **The body is `options.source`, and there is nowhere else to read it
    // from.** The contract used to say where a write's body goes twice and
    // differently — the capability atom put it in the options, this type's
    // config told the caller to pass it there — so this read the config only
    // and the documented call sent `undefined`. It then read both, and said
    // that choosing was the contract's job. `interfaces-adt` 7.0.0 chose
    // (decision 33) and took `source` off this config: nothing but the write
    // ever read it, since this type has no `check` or `validate` that
    // compiles a source the server does not hold yet.
    //
    // The fields beside it describe a create; on an update nothing here merges
    // them into a document, because nothing is read to merge them into.
    return answering(
      () =>
        updateDomain(
          connection,
          options.headers,
          options.ifMatch,
          {
            domain_name: name,
            transport_request: config.transportRequest,
          },
          options?.source as string,
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
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          domain_name: name,
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
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        deleteDomain(connection, options.headers, {
          domain_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answeringActivation(
      connection,
      (sent) =>
        activateDomain(
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
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkDomainSyntax(
          connection,
          options.headers,
          name,
          version,
          undefined,
          this.logger,
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
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const name = this.name(config);
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockDomain(this.connection, name),
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
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<IDomainConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
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
      nothing,
      options?.analyse,
    );
  }
}
