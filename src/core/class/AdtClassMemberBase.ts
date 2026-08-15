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

import {
  AdtObjectErrorCodes,
  AdtOperationError,
  type HttpError,
  type IAbapConnection,
  type IAdtContentTypes,
  type IAdtSystemContext,
  type ILogger,
  type IObjectVersion,
} from '@mcp-abap-adt/interfaces';
import { safeErrorMessage, safeStringify } from '../../utils/internalUtils';
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
import type { IReadOptions } from '../shared/types';
import { activateClass } from './activation';
import { lockClass } from './lock';
import { getClassMetadata, getClassTransport } from './read';
import type { IClassConfig, IClassState } from './types';
import { unlockClass } from './unlock';
import {
  type ClassIncludeType,
  getClassIncludeVersions,
  getClassVersionSource,
} from './versions';

export abstract class AdtClassMemberBase {
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

  private readonly lockCap = new LockCapability<IClassConfig, IClassState>(
    this.capCtx,
    {
      nameOf: (c) => {
        if (!c.className) throw new Error('Class name is required');
        return c.className;
      },
      acquire: async (ctx, name) => ({
        lockHandle: await lockClass(ctx.connection, name),
      }),
      release: async (ctx, name, handle) => {
        const result = await unlockClass(ctx.connection, name, handle);
        return { unlockResult: result, errors: [] };
      },
    },
  );

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
  async lock(config: Partial<IClassConfig>): Promise<string> {
    const handle = await this.lockCap.lock(config);
    this.lockTracker.track(config.className as string, handle);
    return handle;
  }

  /** Unlock the class. */
  async unlock(
    config: Partial<IClassConfig>,
    lockHandle: string,
  ): Promise<IClassState> {
    const state = await this.lockCap.unlock(config, lockHandle);
    this.lockTracker.untrack(config.className as string);
    return state;
  }

  /**
   * Activate the class.
   *
   * An include has no activation of its own — activating the class publishes
   * whatever its includes now contain.
   */
  async activate(config: Partial<IClassConfig>): Promise<IClassState> {
    if (!config.className) {
      throw new Error('Class name is required');
    }

    const state: IClassState = {
      errors: [],
    };

    try {
      const activateResult = await activateClass(
        this.connection,
        config.className,
      );
      state.activateResult = activateResult;
      return state;
    } catch (error: unknown) {
      const e = error as HttpError;
      const status = e.response?.status;
      const statusText = e.response?.statusText;
      const errorMessage = e.response?.data
        ? typeof e.response.data === 'string'
          ? e.response.data.substring(0, 500)
          : safeStringify(e.response.data).substring(0, 500)
        : e.message || 'Unknown error';

      this.logger?.error?.(
        `Activate failed: HTTP ${status || '?'} ${statusText || ''}`,
        { status, statusText, message: errorMessage },
      );

      if (status && status >= 400 && status < 500) {
        const customError = new AdtOperationError(
          `Activation failed for object '${config.className}': ${errorMessage}`,
        );
        customError.code = AdtObjectErrorCodes.ACTIVATE_FAILED;
        customError.status = status;
        customError.statusText = statusText;
        customError.originalError = error;
        throw customError;
      }

      throw error;
    }
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
    options?: IReadOptions,
  ): Promise<IClassState> {
    const state: IClassState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const readOptions = this.contentTypes
        ? { ...options, accept: this.contentTypes.classRead().accept }
        : options;
      const response = await getClassMetadata(
        this.connection,
        config.className,
        readOptions,
      );
      state.metadataResult = response;
      this.logger?.info?.('Class metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readMetadata',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Read metadata failed:', safeErrorMessage(err));
      throw err;
    }
  }

  /**
   * Transport request of the container class.
   *
   * An include is never in a transport of its own — it travels inside its
   * class, so this reads the class's.
   */
  async readTransport(
    config: Partial<IClassConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<IClassState> {
    const state: IClassState = { errors: [] };
    if (!config.className) {
      const error = new Error('Class name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getClassTransport(
        this.connection,
        config.className,
        options,
      );
      state.transportResult = response;
      this.logger?.info?.('Transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readTransport',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('Read transport failed:', safeErrorMessage(err));
      throw err;
    }
  }

  getVersionSource(contentUri: string): Promise<string> {
    return this.versionsCap.getVersionSource(contentUri);
  }

  /** Version history of one include, or of `main` for the class itself. */
  protected getIncludeVersions(
    className: string,
    includeType: ClassIncludeType,
  ): Promise<IObjectVersion[]> {
    return getClassIncludeVersions(this.connection, className, includeType);
  }

  /** Version history of whatever the concrete handler's subject is. */
  abstract getVersions(
    config: Partial<IClassConfig>,
  ): Promise<IObjectVersion[]>;
}
