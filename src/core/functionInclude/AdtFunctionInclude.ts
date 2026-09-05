/**
 * AdtFunctionInclude - CRUD for `FUGR/I` function-group includes.
 *
 * **Not the same thing as a standalone `PROG/I` include** — see
 * `src/core/include/index.ts` for the comparison. This one is a sub-resource of
 * a function group, so every request needs both names and there is no
 * validation collection of its own.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */

import type {
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  ICreateFunctionIncludeParams,
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
import type { LockRegistry } from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { activateFunctionInclude } from './activation';
import { checkFunctionInclude } from './check';
import { create as createFunctionInclude } from './create';
import {
  checkDeletion,
  deleteFunctionInclude,
  type IDeleteFunctionIncludeParams,
} from './delete';
import { lockFunctionInclude } from './lock';
import { readFunctionInclude } from './read';
import { readFunctionIncludeSource } from './readSource';
import {
  functionIncludeDocuments,
  type IFunctionIncludeConfig,
  type IFunctionIncludeResults,
} from './types';
import { unlockFunctionInclude } from './unlock';
import { updateFunctionInclude } from './update';
import { uploadFunctionIncludeSource } from './updateSource';
import { validateFunctionIncludeName } from './validation';
import {
  getFunctionIncludeVersionSource,
  getFunctionIncludeVersions,
} from './versions';

export class AdtFunctionInclude<
  R extends IFunctionIncludeResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IFunctionIncludeResults,
> implements
    IAdtCreatable<IFunctionIncludeConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IFunctionIncludeConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IFunctionIncludeConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IFunctionIncludeConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IFunctionIncludeConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IFunctionIncludeConfig, ReturnType<R['check']>>,
    IAdtActivatable<IFunctionIncludeConfig, ReturnType<R['activation']>>,
    IAdtLockable<IFunctionIncludeConfig>,
    IAdtVersionable<IFunctionIncludeConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  private readonly lockRegistry?: LockRegistry;
  public readonly objectType: string = 'FunctionInclude';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default. See AdtClass.
    protected readonly results: R = functionIncludeDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.contentTypes = contentTypes;
    this.lockRegistry = lockRegistry;
  }

  /** Registry key for a held lock (nested: group + include). */
  private lockKey(group: string, includeName: string): string {
    return `${this.objectType}/${group.toUpperCase()}/${includeName.toUpperCase()}`;
  }

  /** Record a held lock; the unlock thunk needs the parent function group. */
  private trackLock(
    group: string,
    includeName: string,
    lockHandle: string,
  ): void {
    // Raw unlock — LockRegistry.unlockAll() manages the session for the batch.
    this.lockRegistry?.track(this.lockKey(group, includeName), () =>
      unlockFunctionInclude(this.connection, group, includeName, lockHandle),
    );
  }

  /** Drop a lock from the registry after a clean unlock. */
  private untrackLock(group: string, includeName: string): void {
    this.lockRegistry?.untrack(this.lockKey(group, includeName));
  }

  /** Both names, or the caller's mistake. */
  private names(config: Partial<IFunctionIncludeConfig>): {
    group: string;
    include: string;
  } {
    if (!config.functionGroupName) {
      throw new Error('Function group name is required');
    }
    if (!config.includeName) {
      throw new Error('Include name is required');
    }
    return { group: config.functionGroupName, include: config.includeName };
  }

  /** Map camelCase config to the snake_case low-level params. */
  private buildCreateParams(
    config: IFunctionIncludeConfig,
  ): ICreateFunctionIncludeParams {
    return {
      function_group_name: config.functionGroupName,
      include_name: config.includeName,
      description: config.description,
      transport_request: config.transportRequest,
      master_system: config.masterSystem ?? this.systemContext.masterSystem,
      responsible: config.responsible ?? this.systemContext.responsible,
    };
  }

  private buildDeleteParams(
    config: Partial<IFunctionIncludeConfig>,
  ): IDeleteFunctionIncludeParams {
    return {
      function_group_name: config.functionGroupName ?? '',
      include_name: config.includeName ?? '',
      transport_request: config.transportRequest,
    };
  }

  /**
   * Resolve source artifact content type — used both for the source-aware
   * checkrun payload and for the unicode flag of the source upload.
   */
  private sourceArtifactContentType(): string {
    return this.contentTypes?.sourceArtifactContentType() ?? 'text/plain';
  }

  private isUnicode(): boolean {
    return this.sourceArtifactContentType().includes('utf-8');
  }

  /**
   * Validate by probing the parent function group's existence.
   *
   * There is no validation resource for a function include, so this is the only
   * thing that can be checked before the POST.
   */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const { group, include } = this.names(config);

    return answering(
      () => validateFunctionIncludeName(this.connection, group, include),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the include, and write and activate its source if any was given. */
  async create<E extends IAdtError = IAdtError>(
    config: IFunctionIncludeConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    const { group, include } = this.names(config);
    if (!config.description) {
      throw new Error('Description is required');
    }
    const source = options?.sourceCode || config.sourceCode;

    // The source upload below is a LOCK…UNLOCK window.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting function include after failure');
          await deleteFunctionInclude(
            this.connection,
            this.buildDeleteParams(config),
          );
        });
      }

      this.logger?.info?.('Validating parent function group');
      await step(this.validate(config, options));

      this.logger?.info?.('Creating function include');
      const value = await step(
        answering(
          () =>
            createFunctionInclude(
              this.connection,
              this.buildCreateParams(config),
            ),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      created = true;
      this.logger?.info?.('Function include created');

      if (source) {
        this.logger?.info?.('Locking function include for source upload');
        this.connection.setSessionType('stateful');
        const lockHandle = await lockFunctionInclude(
          this.connection,
          group,
          include,
          this.logger,
        );
        this.trackLock(group, include, lockHandle);
        config.onLock?.(lockHandle);
        const releaseLock = onScopeEnd(async () => {
          await unlockFunctionInclude(
            this.connection,
            group,
            include,
            lockHandle,
          );
          this.untrackLock(group, include);
        });

        this.logger?.info?.('Uploading function include source');
        await step(
          answering(
            () =>
              uploadFunctionIncludeSource(
                this.connection,
                group,
                include,
                source,
                lockHandle,
                this.isUnicode(),
                config.transportRequest,
              ),
            this.results.source as IResultStrategy<ReturnType<R['source']>>,
            options?.analyse,
          ),
        );

        this.logger?.info?.('Unlocking function include');
        this.connection.setSessionType('stateful');
        await unlockFunctionInclude(
          this.connection,
          group,
          include,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        this.untrackLock(group, include);
        releaseLock();

        this.logger?.info?.('Activating function include');
        await step(this.activate(config, options));
      }

      return value;
    });
  }

  /**
   * Read the include's source.
   *
   * `read()` is the source, as the contract says of an object that has one.
   * Historically it answered metadata, which disagreed with class, program and
   * function module.
   */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    const { group, include } = this.names(config);

    return answering(
      () =>
        readFunctionIncludeSource(
          this.connection,
          group,
          include,
          version ?? 'active',
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /**
   * Read the include's `finclude` metadata document.
   *
   * A different resource from the source, and the only one that takes
   * `withLongPolling` — which is why the readiness polls after a write read
   * this rather than the source.
   */
  async readMetadata(
    config: Partial<IFunctionIncludeConfig>,
    options?: IReadOptions & {
      version?: 'active' | 'inactive';
    } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const { group, include } = this.names(config);

    return answering(
      () =>
        readFunctionInclude(
          this.connection,
          group,
          include,
          options?.version ?? 'active',
          options,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /**
   * Update the include: its metadata, and its source when source was given.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const { group, include } = this.names(config);
    const fullConfig: IFunctionIncludeConfig = {
      ...(config as IFunctionIncludeConfig),
    };
    const params = this.buildCreateParams(fullConfig);
    const source = options?.sourceCode || config.sourceCode;

    if (options?.lockHandle) {
      const handle = options.lockHandle;
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return chain(this.logger, async ({ step }) => {
        const updated = await step(
          answering(
            () =>
              updateFunctionInclude(
                this.connection,
                params,
                handle,
                this.logger,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        if (source) {
          await step(
            answering(
              () =>
                uploadFunctionIncludeSource(
                  this.connection,
                  group,
                  include,
                  source,
                  handle,
                  this.isUnicode(),
                  fullConfig.transportRequest,
                ),
              this.results.source as IResultStrategy<ReturnType<R['source']>>,
              options?.analyse,
            ),
          );
        }
        return updated;
      });
    }

    // A LOCK…UNLOCK window: a timeout in the middle releases the lock and
    // leaves the work half done.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Step 1: Locking function include');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: a handle is only valid inside a
      // stateful request on older BASIS (#106).
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockFunctionInclude(
        this.connection,
        group,
        include,
        this.logger,
      );
      this.trackLock(group, include, lockHandle);
      fullConfig.onLock?.(lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockFunctionInclude(
          this.connection,
          group,
          include,
          lockHandle,
        );
        this.untrackLock(group, include);
      });
      this.logger?.info?.('Function include locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () =>
              checkFunctionInclude(
                this.connection,
                group,
                include,
                'inactive',
                source,
                this.sourceArtifactContentType(),
              ),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      this.logger?.info?.('Step 3: Updating function include metadata');
      const updated = await step(
        answering(
          () =>
            updateFunctionInclude(
              this.connection,
              params,
              lockHandle,
              this.logger,
            ),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );

      if (source) {
        this.logger?.info?.('Step 3b: Uploading function include source');
        await step(
          answering(
            () =>
              uploadFunctionIncludeSource(
                this.connection,
                group,
                include,
                source,
                lockHandle,
                this.isUnicode(),
                fullConfig.transportRequest,
              ),
            this.results.source as IResultStrategy<ReturnType<R['source']>>,
            options?.analyse,
          ),
        );

        // The write produced the inactive version; the active one may not exist
        // yet. A failure here is not the update's failure, so it is logged and
        // the chain continues — the unlock still has to happen.
        const ready = await this.readMetadata(config, {
          version: 'inactive',
          withLongPolling: true,
        });
        if (!ready.ok) {
          this.logger?.warn?.(
            'read with long polling failed after update:',
            ready.getError().message,
          );
        }
      }

      this.logger?.info?.('Step 4: Unlocking function include');
      this.connection.setSessionType('stateful');
      await unlockFunctionInclude(this.connection, group, include, lockHandle);
      this.connection.setSessionType('stateless');
      this.untrackLock(group, include);
      releaseLock();

      this.logger?.info?.('Step 5: Final check');
      await step(this.check(config, 'inactive', options));

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating function include');
        await step(this.activate(config, options));

        const ready = await this.readMetadata(config, {
          version: 'active',
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
   * Delete the include.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    this.names(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking function include for deletion');
      await step(
        answering(
          () => checkDeletion(this.connection, this.buildDeleteParams(config)),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      this.logger?.info?.('Deleting function include');
      const value = await step(
        answering(
          () =>
            deleteFunctionInclude(
              this.connection,
              this.buildDeleteParams(config),
            ),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Function include deleted');
      return value;
    });
  }

  /** Activate the include. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const { group, include } = this.names(config);

    return answering(
      () => activateFunctionInclude(this.connection, group, include),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the include. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    status?: string,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const { group, include } = this.names(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkFunctionInclude(
          this.connection,
          group,
          include,
          version,
          config.sourceCode,
          this.sourceArtifactContentType(),
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the include for modification. */
  async lock(
    config: Partial<IFunctionIncludeConfig>,
  ): Promise<IAdtResponse<string>> {
    const { group, include } = this.names(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockFunctionInclude(
          this.connection,
          group,
          include,
          this.logger,
        );
        this.trackLock(group, include, lockHandle);
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

  /** Unlock the include. */
  async unlock(
    config: Partial<IFunctionIncludeConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const { group, include } = this.names(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        const result = await unlockFunctionInclude(
          this.connection,
          group,
          include,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        this.untrackLock(group, include);
        return result;
      },
      () => undefined,
    );
  }

  /** Version history of the include's source. */
  async getVersions(
    config: Partial<IFunctionIncludeConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getFunctionIncludeVersions(this.connection, config),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => answer.data as ObjectVersion[],
    );
  }

  /** The source of one version, by the `contentUri` an entry carries. */
  async getVersionSource(contentUri: string): Promise<IAdtResponse<string>> {
    return answering(
      async () => ({
        data: await getFunctionIncludeVersionSource(
          this.connection,
          contentUri,
        ),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => String(answer.data),
    );
  }
}
