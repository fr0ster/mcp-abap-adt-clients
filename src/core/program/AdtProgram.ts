/**
 * AdtProgram - CRUD for `PROG/P` programs.
 *
 * Every member answers `IAdtResponse<T>`, where T is whatever the result set
 * given at construction makes of that endpoint's answer. What runs before the
 * member's own request — a lock, a check — is this implementation's business
 * and is not in the answer: only its failures are, because a step that failed
 * is why the member has no result.
 *
 * Session management:
 * - stateful only around a lock, restored on every path out of the chain
 * - activate needs no stateful session; it uses the same cookies
 *
 * Operation chains:
 * - Create: create (with source, if given)
 * - Update: lock → check(inactive) → update → unlock → check → activate
 * - Delete: check(deletion) → delete
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
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { activateProgram } from './activation';
import { checkProgram } from './check';
import { create as createProgram } from './create';
import { checkDeletion, deleteProgram } from './delete';
import { lockProgram } from './lock';
import {
  getProgramMetadata,
  getProgramSource,
  getProgramTransport,
} from './read';
import {
  type IProgramConfig,
  type IProgramResults,
  programDocuments,
} from './types';
import { unlockProgram } from './unlock';
import { uploadProgramSource } from './update';
import { validateProgramName } from './validation';
import { getProgramVersionSource, getProgramVersions } from './versions';

export class AdtProgram<R extends IProgramResults = typeof programDocuments>
  implements
    IAdtCreatable<IProgramConfig, ReturnType<R['created']>>,
    IAdtReadable<IProgramConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IProgramConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<IProgramConfig>, ReturnType<R['updated']>>,
    IAdtDeletable<
      IProgramConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IProgramConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IProgramConfig, ReturnType<R['check']>>,
    IAdtActivatable<IProgramConfig, ReturnType<R['activation']>>,
    IAdtLockable<IProgramConfig>,
    IAdtTransportAware<IProgramConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IProgramConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Program';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: `programDocuments`
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = programDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.contentTypes = contentTypes;
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (programName, lockHandle) =>
        unlockProgram(this.connection, programName, lockHandle),
    );
  }

  /** Validate a program name before creating it. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Nothing was asked of the server, so there is no answer to describe: a
    // missing required argument is the caller's mistake and it throws.
    // The endpoint requires it: without `packagename` it answers 400, so a
    // missing package is a caller error worth naming here rather than an HTTP
    // failure to decode later.

    return answering(
      () =>
        validateProgramName(
          connection,
          config.programName as string,
          config.packageName as string,
          config.description,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the program. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IProgramConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // **The one guard this package keeps, and only on a create.**
    //
    // An object created without a package is the single thing `delete()` cannot
    // undo: the deletion check resolves through the package, so it answers
    // "Object does not exist" while the name stays taken for good, and clearing
    // it is SAP GUI territory. Everywhere else a missing field produces a
    // request the server answers, which is a reading a strategy can take. Here
    // it produces a state with no way out through ADT at all.
    if (!config.packageName) {
      throw new Error(
        'packageName is required for create: an object created without one cannot be deleted through ADT',
      );
    }

    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.programName as string;
    return answering(
      () =>
        createProgram(
          connection,
          {
            programName: name,
            packageName: config.packageName as string,
            transportRequest: config.transportRequest,
            description: config.description,
            programType: config.programType,
            application: config.application,
            // No `sourceCode` here. `create` is the POST that makes the
            // program, and it sends metadata only — the source is a PUT to
            // `…/source/main` under a lock, which this member neither holds nor
            // can obtain. Passing the field read as if it did something, and it
            // never did: a program created with a body came back empty, and the
            // only symptom was the object failing to do its job later. Writing
            // the source is `update`'s, after `lock`. See
            // fr0ster/mcp-abap-adt-interfaces#76 for taking the field off the
            // create contract so the compiler says this instead of a comment.
            masterSystem: this.systemContext.masterSystem,
            responsible: this.systemContext.responsible,
            masterLanguage:
              config.masterLanguage ?? this.systemContext.masterLanguage,
          },
          this.contentTypes,
        ),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the program's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // No 404 special case any more. ADT answers a read for a missing program
    // with 200 and an empty body, so absence was never a status to branch on —
    // and whether an empty body *is* absence is the caller's reading, supplied
    // through `analyse`.
    return answering(
      () =>
        getProgramSource(
          connection,
          config.programName as string,
          version,
          options,
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the program's metadata: package, responsible, description. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getProgramMetadata(connection, config.programName as string, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /**
   * Write the program's source.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain, so
   * this is one request. Without it, this locks, checks, writes and unlocks —
   * and the unlock happens on every path out.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.programName as string;
    // The source is the caller's, through `options.sourceCode`. This used to
    // fall back to `config.sourceCode` — two channels for one value, where the
    // contract documents one. `config.sourceCode` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.sourceCode;
    const sessionId = connection.getSessionId?.() || '';

    return answering(
      () =>
        uploadProgramSource(
          connection,
          name,
          source as string,
          options?.lockHandle as string,
          sessionId,
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
    config: Partial<IProgramConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.programName as string;
    return answering(
      () =>
        checkDeletion(connection, {
          programName: name,
          transportRequest: config.transportRequest,
        }),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
  }

  /**
   * Delete the program.
   *
   * The deletion check is read, not merely performed: ADT answers a refusal
   * with `del:isDeletable="false"` inside a 200, and a delete that ignored it
   * reported success while the object stayed. {@link deletionRefusal} is the
   * shipped reading of that answer; a caller who wants another passes their own
   * `analyse`.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.programName as string;
    return answering(
      () =>
        deleteProgram(connection, {
          programName: name,
          transportRequest: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the program. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () => activateProgram(connection, config.programName as string),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Check the program. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkProgram(
          connection,
          config.programName as string,
          version,
          config.sourceCode,
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** The transport request the program belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getProgramTransport(
          connection,
          config.programName as string,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /** Lock the program for modification. */
  async lock(config: Partial<IProgramConfig>): Promise<IAdtResponse<string>> {
    const name = config.programName as string;

    return answering(
      async () => {
        const lockHandle = await inStatefulSession(this.connection, () =>
          lockProgram(this.connection, name),
        );
        this.lockTracker.track(name, lockHandle);
        // The handle is the value, and the request that produced it does not
        // keep the wire it came on — so this is the one place the answer is
        // built around what the request produced.
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

  /** Unlock the program. */
  async unlock(
    config: Partial<IProgramConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = config.programName as string;

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        const result = await inStatefulSession(this.connection, () =>
          unlockProgram(this.connection, name, lockHandle),
        );
        this.lockTracker.untrack(name);
        return result;
      },
      () => undefined,
    );
  }

  /** Version history of the program's source. */
  async getVersions(
    config: Partial<IProgramConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getProgramVersions(this.connection, config),
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
        data: await getProgramVersionSource(this.connection, contentUri),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => String(answer.data),
    );
  }
}
