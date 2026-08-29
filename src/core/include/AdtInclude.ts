/**
 * `PROG/I` includes — CRUD and lifecycle.
 *
 * The operation chain is the captured Eclipse one, not a guess:
 *
 * ```
 * POST   /programs/includes                                   create
 * POST   /programs/includes/{name}?_action=LOCK&accessMode=MODIFY
 * PUT    /programs/includes/{name}/source/main?lockHandle=…    text/plain; charset=utf-8
 * POST   /programs/includes/{name}?_action=UNLOCK&lockHandle=…
 * POST   /activation?method=activate&preauditRequested=true
 * ```
 *
 * The capabilities this declares are the ones an include has. It is **not**
 * `IAdtObject`: nothing measured says an include is versionable, and claiming a
 * capability a type does not have is the defect the narrowed factory returns
 * were introduced to remove. Validation is included because
 * `/includes/validation` was measured to answer — with the same three
 * parameters `/programs/validation` takes.
 *
 * See `./index.ts` for why this is a different resource from a function-group
 * include, which lives in `src/core/functionInclude/`.
 */

import type {
  IAbapConnection,
  IAdtActivatable,
  IAdtContentTypes,
  IAdtCrud,
  IAdtLockable,
  IAdtOperationOptions,
  IAdtValidatable,
  IIncludeConfig,
  IIncludeState,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { safeErrorMessage } from '../../utils/internalUtils';
import { activateInclude } from './activation';
import { create } from './create';
import { deleteInclude } from './delete';
import { lockInclude } from './lock';
import { getIncludeMetadata, getIncludeSource } from './read';
import { unlockInclude } from './unlock';
import { uploadIncludeSource } from './update';

type IncludeError = IIncludeState['errors'][number];

function emptyState(): IIncludeState {
  return { errors: [] } as IIncludeState;
}

/** The shape the state's `errors` array actually takes. */
function asError(method: string, error: unknown): IncludeError {
  return {
    method,
    error: error instanceof Error ? error : new Error(safeErrorMessage(error)),
    timestamp: new Date(),
  } as IncludeError;
}

function requireName(config: Partial<IIncludeConfig>): string {
  if (!config.includeName) {
    throw new Error('includeName is required');
  }
  return config.includeName;
}

export class AdtInclude
  implements
    IAdtCrud<IIncludeConfig, IIncludeState>,
    IAdtValidatable<IIncludeConfig, IIncludeState>,
    IAdtActivatable<IIncludeConfig, IIncludeState>,
    IAdtLockable<IIncludeConfig, IIncludeState>
{
  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger?: ILogger,
    private readonly contentTypes?: IAdtContentTypes,
  ) {}

  /**
   * Validate before creating.
   *
   * Measured: `/includes/validation` takes `objname`, `objtype`, `packagename`
   * — the same three `/programs/validation` takes, with `description`
   * optional. Eclipse does not call it in the captured create, so this is
   * available rather than obligatory.
   */
  async validate(config: Partial<IIncludeConfig>): Promise<IIncludeState> {
    const state = emptyState();
    const includeName = requireName(config);
    if (!config.packageName) {
      throw new Error('packageName is required for validation');
    }

    const params = new URLSearchParams({
      objname: includeName.toUpperCase(),
      objtype: 'PROG/I',
      packagename: config.packageName.toUpperCase(),
    });
    if (config.description) {
      params.set('description', config.description);
    }

    try {
      state.validationResponse = await this.connection.makeAdtRequest({
        url: `/sap/bc/adt/includes/validation?${params.toString()}`,
        method: 'POST',
        timeout: 45000,
        headers: { Accept: 'application/vnd.sap.as+xml' },
      });
    } catch (error) {
      state.errors.push(asError('validate', error));
    }
    return state;
  }

  /**
   * Create, then optionally write the source under a lock, then optionally
   * activate.
   *
   * The source may come from `options.sourceCode` or from the config, options
   * winning — the same precedence every other handler here uses. An empty
   * string is a source; only `undefined` means none was given.
   *
   * Activation happens only when `options.activateOnCreate` asks for it: the
   * contract defaults it to `false`, and an earlier version of this method
   * activated unconditionally whenever a source was present, which is a
   * different behaviour wearing the same signature.
   *
   * `options.deleteOnFailure` removes the include again if a step after the
   * metadata POST fails — otherwise a half-made object is left behind under a
   * name the caller will collide with on its next attempt.
   */
  async create(
    config: IIncludeConfig,
    options?: IAdtOperationOptions,
  ): Promise<IIncludeState> {
    const state = emptyState();
    const includeName = requireName(config);
    if (!config.packageName) {
      throw new Error('packageName is required to create an include');
    }

    try {
      state.createResult = await create(
        this.connection,
        {
          includeName,
          description: config.description,
          packageName: config.packageName,
          transportRequest: config.transportRequest,
          masterLanguage: config.masterLanguage,
        },
        this.contentTypes,
      );
    } catch (error) {
      state.errors.push(asError('create', error));
      return state;
    }

    // `!== undefined`, not truthiness: `''` is a source, and an empty include
    // is a legitimate object — this class says so two paragraphs up. Treating
    // the empty string as "no source given" makes one valid value unreachable.
    const sourceCode = options?.sourceCode ?? config.sourceCode;
    if (sourceCode !== undefined) {
      const written = await this.writeSource(config, sourceCode, options);
      state.lockHandle = written.lockHandle;
      state.updateResult = written.updateResult;
      state.unlockResult = written.unlockResult;
      state.errors.push(...written.errors);
      if (options?.activateOnCreate && written.errors.length === 0) {
        await this.activateInto(state, includeName);
      }
    }

    // The object exists from here on, so a later failure leaves a half-made
    // include behind unless the caller asked otherwise.
    if (options?.deleteOnFailure && state.errors.length > 0) {
      await this.rollBackCreate(state, config);
    }

    return state;
  }

  /**
   * Undo a create whose later steps failed, when `deleteOnFailure` asks.
   *
   * The failure that caused this is already in `state.errors` and must stay
   * the headline: a rollback that cannot complete is recorded beside it, never
   * in place of it, and never thrown — the caller is already handling one
   * failure and a second thrown from the cleanup hides the first.
   */
  private async rollBackCreate(
    state: IIncludeState,
    config: Partial<IIncludeConfig>,
  ): Promise<void> {
    this.logger?.warn?.('Deleting include after a failed create', {
      includeName: config.includeName,
    });
    try {
      const deleted = await this.delete(config);
      state.deleteResult = deleted.deleteResult;
      state.errors.push(...deleted.errors);
    } catch (error) {
      state.errors.push(asError('deleteOnFailure', error));
    }
  }

  async read(
    config: Partial<IIncludeConfig>,
    version?: 'active' | 'inactive',
  ): Promise<IIncludeState | undefined> {
    const state = emptyState();
    try {
      state.readResult = await getIncludeSource(
        this.connection,
        requireName(config),
        version,
      );
    } catch (error) {
      state.errors.push(asError('read', error));
    }
    return state;
  }

  async readMetadata(config: Partial<IIncludeConfig>): Promise<IIncludeState> {
    const state = emptyState();
    try {
      state.readResult = await getIncludeMetadata(
        this.connection,
        requireName(config),
      );
    } catch (error) {
      state.errors.push(asError('readMetadata', error));
    }
    return state;
  }

  /**
   * Write new source.
   *
   * `options.sourceCode` wins over the config's. `options.lockHandle` means the
   * caller already holds the lock and manages it — this then writes only, and
   * neither locks nor unlocks. Activation is `options.activateOnUpdate`, which
   * the contract defaults to `false`.
   */
  async update(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IIncludeState> {
    const state = emptyState();
    // Absence, not emptiness: clearing an include to empty is a real edit, and
    // a truthiness check made it impossible to express.
    const sourceCode = options?.sourceCode ?? config.sourceCode;
    if (sourceCode === undefined) {
      throw new Error(
        'sourceCode is required to update an include — pass it in the config or in options',
      );
    }

    const written = await this.writeSource(config, sourceCode, options);
    state.lockHandle = written.lockHandle;
    state.updateResult = written.updateResult;
    state.unlockResult = written.unlockResult;
    state.errors.push(...written.errors);
    if (options?.activateOnUpdate && written.errors.length === 0) {
      await this.activateInto(state, requireName(config));
    }
    return state;
  }

  async delete(config: Partial<IIncludeConfig>): Promise<IIncludeState> {
    const state = emptyState();
    const includeName = requireName(config);
    let lockHandle: string | undefined;

    try {
      this.connection.setSessionType?.('stateful');
      const locked = await lockInclude(this.connection, includeName);
      lockHandle = locked.lockHandle;
      // Preserved for the caller even on failure — an unreleased handle is
      // what leaves an object stuck for everyone else.
      state.lockHandle = lockHandle;

      state.deleteResult = await deleteInclude(
        this.connection,
        includeName,
        lockHandle,
        config.transportRequest ?? locked.corrNr,
      );
      // The handle is deliberately NOT cleared here. A successful DELETE was
      // assumed to release the lock with the object; measured on E19
      // (`RFCSAPRL 816`) it does not. The object goes, the editing
      // registration on its name stays, and the next create for that name is
      // answered **403 ExceptionResourceNoAuthorization, "User … is currently
      // editing …"** — in the same session, on a name nothing else had
      // touched. So the unlock below still has to run.
    } catch (error) {
      state.errors.push(asError('delete', error));
    } finally {
      // `quiet`: after a successful DELETE the object no longer exists, so the
      // unlock may well be refused. That refusal is not a failure of the
      // delete, and recording it as one would make every cleanup look broken
      // to a caller that checks `state.errors`.
      await this.releaseAndGoStateless(state, includeName, lockHandle, {
        quiet: state.deleteResult !== undefined,
      });
    }
    return state;
  }

  async activate(config: Partial<IIncludeConfig>): Promise<IIncludeState> {
    const state = emptyState();
    await this.activateInto(state, requireName(config));
    return state;
  }

  async lock(config: Partial<IIncludeConfig>): Promise<string> {
    this.connection.setSessionType?.('stateful');
    const { lockHandle } = await lockInclude(
      this.connection,
      requireName(config),
    );
    config.onLock?.(lockHandle);
    return lockHandle;
  }

  async unlock(
    config: Partial<IIncludeConfig>,
    lockHandle: string,
  ): Promise<IIncludeState> {
    const state = emptyState();
    try {
      state.unlockResult = await unlockInclude(
        this.connection,
        requireName(config),
        lockHandle,
      );
    } catch (error) {
      state.errors.push(asError('unlock', error));
    } finally {
      this.connection.setSessionType?.('stateless');
    }
    return state;
  }

  /**
   * lock → PUT source → unlock, with the handle always released.
   *
   * When the caller supplies `options.lockHandle` it owns the lock: this writes
   * under it and does NOT unlock, because releasing somebody else's lock is how
   * a caller's own next request starts failing.
   */
  private async writeSource(
    config: Partial<IIncludeConfig>,
    sourceCode: string,
    options?: IAdtOperationOptions,
  ): Promise<
    Pick<IIncludeState, 'lockHandle' | 'updateResult' | 'unlockResult'> & {
      errors: IncludeError[];
    }
  > {
    const includeName = requireName(config);
    const result: Pick<
      IIncludeState,
      'lockHandle' | 'updateResult' | 'unlockResult'
    > & { errors: IncludeError[] } = { errors: [] };

    // A caller-held lock is used, recorded and NOT released here.
    const borrowed = options?.lockHandle;
    let lockHandle: string | undefined = borrowed;
    let corrNr: string | undefined;

    try {
      if (!borrowed) {
        this.connection.setSessionType?.('stateful');
        const locked = await lockInclude(this.connection, includeName);
        lockHandle = locked.lockHandle;
        corrNr = locked.corrNr;
        config.onLock?.(lockHandle);
      }
      result.lockHandle = lockHandle;

      result.updateResult = await uploadIncludeSource(
        this.connection,
        includeName,
        sourceCode,
        lockHandle as string,
        config.transportRequest ?? corrNr,
      );
    } catch (error) {
      result.errors.push(asError('update', error));
    } finally {
      if (!borrowed) {
        const unlockResult = await this.releaseAndGoStateless(
          result,
          includeName,
          lockHandle,
        );
        if (unlockResult) {
          result.unlockResult = unlockResult;
        }
      }
    }
    return result;
  }

  private async activateInto(
    state: { activateResult?: unknown; errors: IncludeError[] },
    includeName: string,
  ): Promise<void> {
    try {
      state.activateResult = await activateInclude(
        this.connection,
        includeName,
      );
    } catch (error) {
      state.errors.push(asError('activate', error));
    }
  }

  /**
   * Release the lock and drop back to stateless — on every path.
   *
   * A failure to unlock is recorded, never thrown: it must not replace the
   * error that caused it, and the session has to go stateless either way.
   */
  private async releaseAndGoStateless(
    state: { errors: IncludeError[] },
    includeName: string,
    lockHandle: string | undefined,
    options?: { quiet?: boolean },
  ) {
    let unlockResult: Awaited<ReturnType<typeof unlockInclude>> | undefined;
    if (lockHandle) {
      try {
        unlockResult = await unlockInclude(
          this.connection,
          includeName,
          lockHandle,
        );
      } catch (error) {
        this.logger?.debug?.('Failed to unlock include', {
          includeName,
          error: safeErrorMessage(error),
        });
        if (!options?.quiet) {
          state.errors.push(asError('unlock', error));
        }
      }
    }
    this.connection.setSessionType?.('stateless');
    return unlockResult;
  }
}
