/**
 * What a class and the includes inside it share.
 *
 * A local include — testclasses, localtypes, definitions, macros — is written
 * under its **class's** lock and activated by activating that class, so it
 * needs exactly this much of a class: the lock, the activation, and the version
 * history of one include. It needs nothing else, and until 2026-08-14 it
 * inherited everything anyway, `AdtClass.create` included — a method that
 * creates a global class, reachable on a handler whose subject is an include.
 *
 * So the shared machinery lives here and `AdtClass` adds its own CRUD on top,
 * rather than the includes extending the class and overriding most of it. Each
 * handler then carries only methods it means.
 */

import type {
  IAdtAnalyseOptions,
  IAdtContentTypes,
  IAdtError,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtSystemContext,
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
import { activateClass } from './activation';
import { lockClass } from './lock';
import { getClassMetadata, getClassTransport } from './read';
import type { classDocuments, IClassConfig, IClassResults } from './types';
import { unlockClass } from './unlock';
import {
  type ClassIncludeType,
  getClassIncludeVersions,
  getClassVersionSource,
} from './versions';

export abstract class AdtClassMemberBase<
  R extends IClassResults = typeof classDocuments,
> {
  /**
   * The readings this implementation performs, given when it was constructed.
   *
   * Declared here and abstract, so every concrete subclass carries it: `activate`
   * and `readMetadata` below answer `ReturnType<R[…]>`, and a base fixed to the
   * defaults would bind them to those while the subclass's `implements` clause
   * promises the caller's — the class would not satisfy the atoms it claims, for
   * exactly the members a consumer is least likely to test.
   */
  protected abstract readonly results: R;

  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  protected readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Class';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.contentTypes = contentTypes;
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (className, lockHandle) =>
        unlockClass(this.connection, className, lockHandle),
    );
  }

  /**
   * Lock the class.
   *
   * This is the lock an include is written under too: ADT locks
   * `/oo/classes/{name}`, never the include, and the PUT that writes the
   * include carries the class's handle.
   */
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const name = config.className as string;
    // One LOCK, its handle read by `lockHandleOf`. A 200 carrying no handle
    // reads as `''`; whether that is a refusal is the caller's `analyse` to say.
    // LOCK must run stateful (older BASIS #106); stateless after.
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockClass(this.connection, name),
        ),
      lockHandleOf,
      options?.analyse,
    );
    if (answer.ok && answer.getResult().value) {
      this.lockTracker.track(name, answer.getResult().value);
    }
    return answer;
  }

  /**
   * Unlock the class — one UNLOCK, SAP's reply read by nothing.
   *
   * Until 23.0.0 this built an empty answer of its own and dropped SAP's.
   */
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    const name = config.className as string;
    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockClass(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      nothing,
      options?.analyse,
    );
  }

  /**
   * Activate the class.
   *
   * An include has no activation of its own — activating the class publishes
   * whatever its includes now contain.
   */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // No server was asked anything, so there is no answer to describe. A missing
    // required argument is the caller's mistake, and it throws.

    return answering(
      () => activateClass(connection, config.className as string),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /**
   * Metadata of the container class.
   *
   * An include has no metadata resource of its own — its package, transport and
   * responsible are the class's. This reads the class, and says so rather than
   * implying the include carries any of it.
   */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const readOptions = this.contentTypes
      ? { ...options, accept: this.contentTypes.classRead().accept }
      : options;

    return answering(
      () =>
        getClassMetadata(connection, config.className as string, readOptions),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /**
   * Transport request of the container class.
   *
   * An include is never in a transport of its own — it travels inside its
   * class, so this reads the class's.
   */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () => getClassTransport(connection, config.className as string, options),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /** Source of one version, by the `contentUri` its entry carried. */
  async getVersionSource<E extends IAdtError = IAdtError>(
    contentUri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['versionSource']>, E>> {
    return answering(
      () => getClassVersionSource(this.connection, contentUri),
      this.results.versionSource as IResultStrategy<
        ReturnType<R['versionSource']>
      >,
      options?.analyse,
    );
  }

  /**
   * Version history of one include, or of `main` for the class itself — the
   * Atom feed read by the `versions` strategy.
   */
  protected includeVersions<E extends IAdtError = IAdtError>(
    className: string,
    includeType: ClassIncludeType,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['versions']>, E>> {
    return answering(
      () => getClassIncludeVersions(this.connection, className, includeType),
      this.results.versions as IResultStrategy<ReturnType<R['versions']>>,
      options?.analyse,
    );
  }

  /** Version history of whatever the concrete implementation's subject is. */
  abstract getVersions<E extends IAdtError = IAdtError>(
    config: Partial<IClassConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['versions']>, E>>;
}
