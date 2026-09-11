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
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtMetadataReadable,
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
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
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
  R extends IFunctionIncludeResults = typeof functionIncludeDocuments,
> implements
    IAdtCreatable<IFunctionIncludeConfig, ReturnType<R['created']>>,
    IAdtReadable<IFunctionIncludeConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IFunctionIncludeConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<IFunctionIncludeConfig>, ReturnType<R['updated']>>,
    IAdtDeletable<
      IFunctionIncludeConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
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
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, include } = this.names(config);

    return answering(
      () => validateFunctionIncludeName(connection, group, include),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the include, and write and activate its source if any was given. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IFunctionIncludeConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Called for its guards: it throws when the name this member needs is
    // missing, which is the one thing checked before the request goes out.
    this.names(config);
    if (!config.description) {
      throw new Error('Description is required');
    }
    return answering(
      () => createFunctionInclude(connection, this.buildCreateParams(config)),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
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
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, include } = this.names(config);

    return answering(
      () =>
        readFunctionIncludeSource(
          connection,
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, include } = this.names(config);

    return answering(
      () =>
        readFunctionInclude(
          connection,
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
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadataUpdated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const params = this.buildCreateParams({
      ...(config as IFunctionIncludeConfig),
    });

    return answering(
      () =>
        updateFunctionInclude(
          connection,
          params,
          options?.lockHandle,
          this.logger,
        ),
      this.results.metadataUpdated as IResultStrategy<
        ReturnType<R['metadataUpdated']>
      >,
      options?.analyse,
    );
  }

  /**
   * Writes the include's `/source/main`.
   *
   * Its own member because it is its own endpoint: `update` writes the
   * `finclude` metadata, and a consumer that wants both issues both, in the
   * order it decides.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, include } = this.names(config);
    // The source is the caller's, through `options.sourceCode`. This used to
    // fall back to `config.sourceCode` — two channels for one value, where the
    // contract documents one. `config.sourceCode` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.sourceCode;
    if (source === undefined) {
      throw new Error('Source code is required for update');
    }

    return answering(
      () =>
        uploadFunctionIncludeSource(
          connection,
          group,
          include,
          source,
          options?.lockHandle,
          this.isUnicode(),
          config.transportRequest,
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
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    this.names(config);
    return answering(
      () => checkDeletion(connection, this.buildDeleteParams(config)),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
  }

  /**
   * Delete the include.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    this.names(config);
    return answering(
      () => deleteFunctionInclude(connection, this.buildDeleteParams(config)),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the include. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, include } = this.names(config);

    return answering(
      () => activateFunctionInclude(connection, group, include),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Check the include. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionIncludeConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const { group, include } = this.names(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkFunctionInclude(
          connection,
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
        const lockHandle = await inStatefulSession(this.connection, () =>
          lockFunctionInclude(this.connection, group, include, this.logger),
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
        const result = await inStatefulSession(this.connection, () =>
          unlockFunctionInclude(this.connection, group, include, lockHandle),
        );
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
