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
  IAbapConnection,
  IAdtContentTypes,
  IAdtOperationOptions,
  IAdtResponse,
  IAdtSystemContext,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../utils/activationUtils';
import { answering } from '../../utils/adtResponse';
import { nothing, rawDocument } from '../../utils/resultStrategy';
import {
  type ICapabilityContext,
  LockCapability,
  VersionsCapability,
} from '../shared/capabilities';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { activateClass } from './activation';
import { lockClass } from './lock';
import { getClassMetadata, getClassTransport } from './read';
import type { IClassConfig, IClassResults } from './types';
import { unlockClass } from './unlock';
import {
  type ClassIncludeType,
  getClassIncludeVersions,
  getClassVersionSource,
} from './versions';

export abstract class AdtClassMemberBase<
  R extends IClassResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IClassResults,
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

  // Arrow-property capabilities read this lazily, so they may be built as class
  // fields even though the constructor has not run when they are constructed.
  private readonly capCtx = (): ICapabilityContext => ({
    connection: this.connection,
    logger: this.logger,
  });

  // One type argument since 31.0.0: the release no longer builds a state shape
  // for anyone to read — `unlock` answers `IAdtResponse<void>`, and what ADT
  // said on the way out is nothing a caller asked for.
  protected readonly lockCap = new LockCapability<IClassConfig>(this.capCtx, {
    nameOf: (c) => {
      if (!c.className) throw new Error('Class name is required');
      return c.className;
    },
    acquire: async (ctx, name) => ({
      lockHandle: await lockClass(ctx.connection, name),
    }),
    release: async (ctx, name, handle) => {
      await unlockClass(ctx.connection, name, handle);
    },
  });

  private readonly versionsCap = new VersionsCapability<IClassConfig>(
    this.capCtx,
    {
      nameOf: (c) => {
        if (!c.className) throw new Error('className is required');
        return c.className;
      },
      list: (ctx, name) =>
        getClassIncludeVersions(ctx.connection, name, 'main'),
      source: (ctx, uri) => getClassVersionSource(ctx.connection, uri),
    },
  );

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
  async lock(config: Partial<IClassConfig>): Promise<IAdtResponse<string>> {
    return answering(
      async () => {
        const handle = await this.lockCap.lockHandle(config);
        this.lockTracker.track(config.className as string, handle);
        // The lock handle is the value, and the wire it came on is not kept by
        // the capability — so this is the one place a strategy has nothing to
        // read and the answer is built from what the request produced.
        return { data: handle, status: 200, statusText: 'OK', headers: {} };
      },
      (answer) => String(answer.data),
    );
  }

  /** Unlock the class. */
  async unlock(
    config: Partial<IClassConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    return answering(async () => {
      await this.lockCap.release(config, lockHandle);
      this.lockTracker.untrack(config.className as string);
      return { data: '', status: 200, statusText: 'OK', headers: {} };
    }, nothing);
  }

  /**
   * Activate the class.
   *
   * An include has no activation of its own — activating the class publishes
   * whatever its includes now contain.
   */
  async activate(
    config: Partial<IClassConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    // No server was asked anything, so there is no answer to describe. A missing
    // required argument is the caller's mistake, and it throws.
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return answering(
      () => activateClass(this.connection, config.className as string),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse ?? activationRefusal,
    );
  }

  /**
   * Metadata of the container class.
   *
   * An include has no metadata resource of its own — its package, transport and
   * responsible are the class's. This reads the class, and says so rather than
   * implying the include carries any of it.
   */
  async readMetadata(
    config: Partial<IClassConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    const readOptions = this.contentTypes
      ? { ...options, accept: this.contentTypes.classRead().accept }
      : options;

    return answering(
      () =>
        getClassMetadata(
          this.connection,
          config.className as string,
          readOptions,
        ),
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
  async readTransport(
    config: Partial<IClassConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<string>> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    return answering(
      () =>
        getClassTransport(this.connection, config.className as string, options),
      rawDocument,
      options?.analyse,
    );
  }

  async getVersionSource(contentUri: string): Promise<IAdtResponse<string>> {
    return answering(
      async () => ({
        data: await this.versionsCap.getVersionSource(contentUri),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      rawDocument,
    );
  }

  /** Version history of one include, or of `main` for the class itself. */
  protected getIncludeVersions(
    className: string,
    includeType: ClassIncludeType,
  ): Promise<ObjectVersion[]> {
    return getClassIncludeVersions(this.connection, className, includeType);
  }

  /**
   * Version history of whatever the concrete handler's subject is.
   *
   * `ObjectVersion` left `@mcp-abap-adt/interfaces` in 31.0.0 with the other
   * result shapes; {@link ObjectVersion} is this package's, declared beside the
   * reading that builds it.
   */
  abstract getVersions(
    config: Partial<IClassConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>>;
}
