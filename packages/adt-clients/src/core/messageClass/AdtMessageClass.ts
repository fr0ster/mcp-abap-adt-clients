/**
 * AdtMessageClass - CRUD for `MSAG/N` message classes.
 *
 * The class is a shell — name, description, package. The messages inside it are
 * written through `AdtMessageClassMessage`. There is no activation: a message
 * class is not an activatable object.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */

import type {
  AdtObjectIdentity,
  AdtReadVersion,
  AdtRequiredUpdateOptions,
  AdtVariant,
  IAdtAnalyseOptions,
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
  IMessageClassResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { MESSAGE_CLASS } from '../../endpoints/objects';
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
import { createMessageClass } from './create';
import { checkDeletion, deleteMessageClass } from './delete';
import { lockMessageClass } from './lock';
import { getMessageClassSource } from './read';
import type { IMessageClassConfig, messageClassDocuments } from './types';
import { unlockMessageClass } from './unlock';
import { updateMessageClass } from './update';

const VALIDATE_BASE = MESSAGE_CLASS.validation;

/** What each slot of the result set answers. */
export type MessageClassValues = {
  readonly [K in keyof IMessageClassResults]: unknown;
};

export class AdtMessageClass<
  T extends MessageClassValues = ResultValuesOf<typeof messageClassDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtCreatable<IMessageClassConfig, T['created']>,
    IAdtMetadataReadable<IMessageClassConfig, T['metadata'], 'name'>,
    IAdtMetadataUpdatable<
      Partial<IMessageClassConfig>,
      T['metadataUpdated'],
      'name',
      'source'
    >,
    IAdtDeletable<
      IMessageClassConfig,
      T['deletion'],
      'name',
      T['deletionCheck']
    >,
    IAdtValidatable<IMessageClassConfig, T['validation'], 'name'>,
    IAdtLockable<IMessageClassConfig, 'name'>
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'MessageClass';

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
        unlockMessageClass(this.connection, name, lockHandle),
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
  private name(config: AdtObjectIdentity<IMessageClassConfig, 'name'>): string {
    return config.name;
  }

  /**
   * Validate name and description.
   *
   * POST with the params in the query string and an empty body — that is what
   * Eclipse sends, and what the other types' validation endpoints take.
   */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const params = new URLSearchParams({ objname: name });
    if (config.description) {
      params.set('description', config.description);
    }

    return answering(
      () =>
        connection.makeAdtRequest({
          url: `${VALIDATE_BASE}?${params.toString()}`,
          method: 'POST',
          timeout: 0,
        }),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the message class shell. No activation — message classes have none. */
  create<E extends IAdtError>(
    config: Omit<IMessageClassConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  create(
    config: Omit<IMessageClassConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IMessageClassConfig, 'source'> & {
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

    this.logger?.info?.('Creating message class');
    return answering(
      () =>
        createMessageClass(connection, options.headers, {
          name,
          description: config.description,
          package_name: config.packageName,
          // config → global systemContext; none invented: without one SAP
          // takes the logon language.
          master_language: createLanguage(
            config.masterLanguage,
            this.systemContext.masterLanguage,
          ),
          // The message class config has no such fields: the client's context.
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
          // sent as ?corrNr= for a transportable package; empty for local
          transport_request: config.transportRequest,
        }),
      this.results.created,
      options?.analyse,
    );
  }

  /** The same document `read` fetches — there is no metadata resource. */
  readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: ({
      withLongPolling?: boolean;
      version?: AdtReadVersion;
    } & IAdtOperationOptions<E>) & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options?: {
      withLongPolling?: boolean;
      version?: AdtReadVersion;
    } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options?: {
      withLongPolling?: boolean;
      version?: AdtReadVersion;
    } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => getMessageClassSource(connection, name, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /**
   * Write the message class's document — one PUT, whose body is
   * `options.source`, under the caller's `options.lockHandle`.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`; `parseMessageClass` and
   * `buildMessageClassXml` are the readings beside it), change what you mean to
   * change, and pass the result: anything left out is gone, because nothing is
   * read here to keep it. Until 23.0.0 this read the class itself and patched
   * `config.description` into it — a second request, and a document this
   * library composed in place of the caller's.
   */
  updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'messageClass', 'updateMetadata'>,
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    this: this & AdtPerformedBy<'messageClass', 'updateMetadata'>,
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'messageClass', 'updateMetadata'>,
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        updateMessageClass(
          connection,
          options.headers,
          options.ifMatch,
          name,
          options?.source,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.metadataUpdated,
      options?.analyse,
    );
  }

  /**
   * Delete the message class.
   *
   * The stateless deletion service (check → delete), no lock: a stateful lock
   * plus a direct DELETE leaves a lingering message-editing enqueue that blocks
   * a same-name re-create. See delete.ts.
   *
   * The check is read, not merely performed — ADT states a refusal inside a
   * 200.
   */
  /**
   * Asks ADT whether the message class can be deleted.
   *
   * Its own member because it is its own endpoint. `delete` no longer runs it:
   * a consumer that wants the check runs this first and decides what a refusal
   * means.
   */
  checkDeletion<E extends IAdtError>(
    this: this & AdtPerformedBy<'messageClass', 'deletionCheck'>,
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  checkDeletion(
    this: this & AdtPerformedBy<'messageClass', 'deletionCheck'>,
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'messageClass', 'deletionCheck'>,
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => checkDeletion(connection, options.headers, name),
      this.results.deletionCheck,
      options?.analyse,
    );
  }

  delete<E extends IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        deleteMessageClass(
          connection,
          options.headers,
          name,
          config.transportRequest,
        ),
      this.results.deletion,
      options?.analyse,
    );
  }

  /**
   * Lock the message class — one LOCK, its handle read by `lockHandleOf`. A 200
   * carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  lock<E extends IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const name = this.name(config);
    return answering(
      async () => {
        const locked = await inStatefulSession(this.connection, () =>
          lockMessageClass(this.connection, name),
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

  /** Unlock the message class. */
  unlock<E extends IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IMessageClassConfig, 'name'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const name = this.name(config);

    return answering(
      // The UNLOCK reaches the context the LOCK opened only if it is sent
      // stateful; stateless, it releases nothing and still answers 200.
      async () => {
        const unlocked = await inStatefulSession(this.connection, () =>
          unlockMessageClass(this.connection, name, lockHandle),
        );
        // The registry records SAP's state, not the caller's verdict: the lock
        // leaves it only when SAP answered the UNLOCK with a 2xx, before any
        // `analyse` runs; a refused or unanswered one may leave it held.
        if (!failedWireStatus(unlocked)) this.lockTracker.untrack(name);
        return unlocked;
      },
      nothing,
      options?.analyse,
    );
  }
}
