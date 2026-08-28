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
   * Create, then write the source under a lock, then activate.
   *
   * Source and activation are conditional: an include with no source is a
   * legitimate thing to create, and activating an empty one is not.
   */
  async create(
    config: IIncludeConfig,
    _options?: IAdtOperationOptions,
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

    if (config.sourceCode) {
      const written = await this.writeSource(config, config.sourceCode);
      state.lockHandle = written.lockHandle;
      state.updateResult = written.updateResult;
      state.unlockResult = written.unlockResult;
      state.errors.push(...written.errors);
      if (written.errors.length === 0) {
        await this.activateInto(state, includeName);
      }
    }

    return state;
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

  async update(config: Partial<IIncludeConfig>): Promise<IIncludeState> {
    const state = emptyState();
    if (!config.sourceCode) {
      throw new Error('sourceCode is required to update an include');
    }

    const written = await this.writeSource(config, config.sourceCode);
    state.lockHandle = written.lockHandle;
    state.updateResult = written.updateResult;
    state.unlockResult = written.unlockResult;
    state.errors.push(...written.errors);
    if (written.errors.length === 0) {
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
      // A successful DELETE releases the lock with the object.
      lockHandle = undefined;
    } catch (error) {
      state.errors.push(asError('delete', error));
    } finally {
      await this.releaseAndGoStateless(state, includeName, lockHandle);
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

  /** lock → PUT source → unlock, with the handle always released. */
  private async writeSource(
    config: Partial<IIncludeConfig>,
    sourceCode: string,
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
    let lockHandle: string | undefined;

    try {
      this.connection.setSessionType?.('stateful');
      const locked = await lockInclude(this.connection, includeName);
      lockHandle = locked.lockHandle;
      result.lockHandle = lockHandle;
      config.onLock?.(lockHandle);

      result.updateResult = await uploadIncludeSource(
        this.connection,
        includeName,
        sourceCode,
        lockHandle,
        config.transportRequest ?? locked.corrNr,
      );
    } catch (error) {
      result.errors.push(asError('update', error));
    } finally {
      const unlockResult = await this.releaseAndGoStateless(
        result,
        includeName,
        lockHandle,
      );
      if (unlockResult) {
        result.unlockResult = unlockResult;
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
      state.errors.push(asError('releaseLock', error));
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
        state.errors.push(asError('unlock', error));
      }
    }
    this.connection.setSessionType?.('stateless');
    return unlockResult;
  }
}
