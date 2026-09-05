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
  IAdtVersionable,
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

export class AdtProgram<
  R extends IProgramResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IProgramResults,
> implements
    IAdtCreatable<IProgramConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IProgramConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IProgramConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IProgramConfig, ReturnType<R['deletion']>>,
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
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // Nothing was asked of the server, so there is no answer to describe: a
    // missing required argument is the caller's mistake and it throws.
    if (!config.programName) {
      throw new Error('Program name is required for validation');
    }
    // The endpoint requires it: without `packagename` it answers 400, so a
    // missing package is a caller error worth naming here rather than an HTTP
    // failure to decode later.
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }

    return answering(
      () =>
        validateProgramName(
          this.connection,
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
    config: IProgramConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    const name = config.programName;

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      this.connection.setSessionType('stateful');
      // Registered before anything can fail, so the session is restored on
      // every path — including the one where the create itself is refused,
      // which used to reach a `catch` and now does not.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting program after failure');
          this.connection.setSessionType('stateful');
          await deleteProgram(this.connection, {
            programName: name,
            transportRequest: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Creating program');
      const value = await step(
        answering(
          () =>
            createProgram(
              this.connection,
              {
                programName: name,
                packageName: config.packageName as string,
                transportRequest: config.transportRequest,
                description: config.description,
                programType: config.programType,
                application: config.application,
                sourceCode: options?.sourceCode || config.sourceCode,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage:
                  config.masterLanguage ?? this.systemContext.masterLanguage,
              },
              this.contentTypes,
            ),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      // Only past the step: a refused create leaves nothing to delete, and the
      // cleanup above must not remove an object this call did not make.
      created = true;
      this.logger?.info?.('Program created');
      return value;
    });
  }

  /** Read the program's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    // No 404 special case any more. ADT answers a read for a missing program
    // with 200 and an empty body, so absence was never a status to branch on —
    // and whether an empty body *is* absence is the caller's reading, supplied
    // through `analyse`.
    return answering(
      () =>
        getProgramSource(
          this.connection,
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
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    return answering(
      () =>
        getProgramMetadata(
          this.connection,
          config.programName as string,
          options,
        ),
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
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    const name = config.programName;
    const source = options?.sourceCode || config.sourceCode;
    const sessionId = this.connection.getSessionId?.() || '';

    if (options?.lockHandle) {
      if (!source) {
        throw new Error('Source code is required for update');
      }
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          uploadProgramSource(
            this.connection,
            name,
            source,
            options.lockHandle as string,
            sessionId,
            config.transportRequest,
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

      this.logger?.info?.('Step 1: Locking program');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: on older BASIS a lock handle is
      // only valid inside a stateful request, so going stateless before the
      // unlock would break the unlock (#106); and if the lock itself throws,
      // the session is still restored.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockProgram(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockProgram(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Program locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () =>
              checkProgram(
                this.connection,
                name,
                'inactive',
                source,
                this.contentTypes?.sourceArtifactContentType(),
              ),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      let updated = undefined as ReturnType<R['updated']>;
      if (source) {
        this.logger?.info?.('Step 3: Updating program');
        updated = await step(
          answering(
            () =>
              uploadProgramSource(
                this.connection,
                name,
                source,
                lockHandle,
                sessionId,
                config.transportRequest,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        this.logger?.info?.('Program updated');

        // The write produced the inactive version; the active one may not
        // exist yet. A failure here is not the update's failure, so it is
        // logged and the chain continues — the unlock still has to happen.
        const ready = await this.read({ programName: name }, 'inactive', {
          withLongPolling: true,
        });
        if (!ready.ok) {
          this.logger?.warn?.(
            'read with long polling failed after update:',
            ready.getError().message,
          );
        }
      }

      this.logger?.info?.('Step 4: Unlocking program');
      this.connection.setSessionType('stateful');
      await unlockProgram(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather
      // than run a second time when the scope unwinds.
      releaseLock();
      this.logger?.info?.('Program unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () => checkProgram(this.connection, name, 'inactive'),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating program');
        await step(
          answering(
            () => activateProgram(this.connection, name),
            this.results.activation as IResultStrategy<
              ReturnType<R['activation']>
            >,
            (options?.analyse ?? activationRefusal) as IAnalyse<E>,
          ),
        );

        const ready = await this.read({ programName: name }, 'active', {
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
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    const name = config.programName;

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      this.logger?.info?.('Checking program for deletion');
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              programName: name,
              transportRequest: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      this.logger?.info?.('Deleting program');
      this.connection.setSessionType('stateful');
      const value = await step(
        answering(
          () =>
            deleteProgram(this.connection, {
              programName: name,
              transportRequest: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Program deleted');
      return value;
    });
  }

  /** Activate the program. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    return answering(
      () => activateProgram(this.connection, config.programName as string),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the program. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IProgramConfig>,
    status?: string,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkProgram(
          this.connection,
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
    options?: { withLongPolling?: boolean } & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    if (!config.programName) {
      throw new Error('Program name is required');
    }

    return answering(
      () =>
        getProgramTransport(
          this.connection,
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
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    const name = config.programName;

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockProgram(this.connection, name);
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
    if (!config.programName) {
      throw new Error('Program name is required');
    }
    const name = config.programName;

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        const result = await unlockProgram(this.connection, name, lockHandle);
        this.connection.setSessionType('stateless');
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
