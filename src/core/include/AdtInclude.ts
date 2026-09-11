/**
 * Standalone `PROG/I` includes — see this module's `index.ts` for how they
 * differ from a function-group include.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer. The error bag this class
 * used to return is gone: a failure now abandons the chain and comes back as
 * the answer, with the request that produced it.
 */
import type {
  IAbapConnection,
  IAdtActivatable,
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
  IAdtUpdatable,
  IAdtValidatable,
  IIncludeConfig,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import { checkDeletionByUri } from '../shared/deletionCheckByUri';
import { activateInclude } from './activation';
import { create } from './create';
import { deleteInclude } from './delete';
import { includeUrl, lockInclude } from './lock';
import { getIncludeMetadata, getIncludeSource } from './read';
import { type IIncludeResults, includeDocuments } from './types';
import { unlockInclude } from './unlock';
import { uploadIncludeSource } from './update';

function requireName(config: Partial<IIncludeConfig>): string {
  if (!config.includeName) {
    throw new Error('includeName is required');
  }
  return config.includeName;
}

export class AdtInclude<R extends IIncludeResults = typeof includeDocuments>
  implements
    IAdtCreatable<IIncludeConfig, ReturnType<R['created']>>,
    IAdtReadable<IIncludeConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IIncludeConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<IIncludeConfig>, ReturnType<R['updated']>>,
    IAdtDeletable<
      IIncludeConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IIncludeConfig, ReturnType<R['validation']>>,
    IAdtActivatable<IIncludeConfig, ReturnType<R['activation']>>,
    IAdtLockable<IIncludeConfig>
{
  constructor(
    private readonly connection: IAbapConnection,
    // Part of the constructor shape every client in this library shares. It is
    // unread here now that the members are single requests with nothing to
    // narrate; removing it would make this one class take different arguments.
    // biome-ignore lint/correctness/noUnusedPrivateClassMembers: uniform constructor
    private readonly logger?: ILogger,
    private readonly contentTypes?: IAdtContentTypes,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = includeDocuments as unknown as R,
  ) {}

  /**
   * Validate before creating.
   *
   * Measured: `/includes/validation` takes `objname`, `objtype`, `packagename`
   * — the same three `/programs/validation` takes, with `description`
   * optional. Eclipse does not call it in the captured create, so this is
   * available rather than obligatory.
   */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

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

    return answering(
      () =>
        connection.makeAdtRequest({
          url: `/sap/bc/adt/includes/validation?${params.toString()}`,
          method: 'POST',
          timeout: 45000,
          headers: { Accept: 'application/vnd.sap.as+xml' },
        }),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /**
   * Create the include, and write its source if any was given.
   *
   * The answer is the create's own. Whether source was written afterwards is
   * this implementation's business — a caller asked for an include, not for a
   * transcript — and a failure in that write is still returned, because it is
   * why the include is not what was asked for.
   */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IIncludeConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);
    if (!config.packageName) {
      throw new Error('packageName is required to create an include');
    }
    return answering(
      () =>
        create(
          connection,
          {
            includeName,
            description: config.description,
            packageName: config.packageName as string,
            transportRequest: config.transportRequest,
            masterLanguage: config.masterLanguage,
          },
          this.contentTypes,
        ),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the include's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    version?: 'active' | 'inactive',
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);
    return answering(
      () => getIncludeSource(connection, includeName, version),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the include's metadata. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);
    return answering(
      () => getIncludeMetadata(connection, includeName),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /**
   * Write new source.
   *
   * `options.sourceCode` wins over the config's. `options.lockHandle` means the
   * caller already holds the lock and manages it — this then writes only, and
   * neither locks nor unlocks. Activation is `options.activateOnUpdate`.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // Absence, not emptiness: clearing an include to empty is a real edit, and
    // a truthiness check made it impossible to express.
    // The source is the caller's, through `options.sourceCode`. This used to
    // fall back to `config.sourceCode` — two channels for one value, where the
    // contract documents one. `config.sourceCode` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const sourceCode = options?.sourceCode;
    if (sourceCode === undefined) {
      throw new Error(
        'sourceCode is required to update an include — pass it in the config or in options',
      );
    }
    const includeName = requireName(config);

    return answering(
      () =>
        uploadIncludeSource(
          connection,
          includeName,
          sourceCode,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
      options?.analyse,
    );
  }

  /**
   * Ask whether the object can be deleted now.
   *
   * The deletion service is asked by URI, and a standalone include has one of
   * its own — unlike a class include, which is emptied by writing its parent.
   */
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);

    return answering(
      () => checkDeletionByUri(connection, includeUrl(includeName)),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
    );
  }

  /**
   * Delete the include.
   *
   * No lock, and `options.lockHandle` is deliberately not read: the deletion
   * service takes an object URI, not a handle. Holding a lock over a delete
   * does not help it through — it is what stops it.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);

    return answering(
      () => deleteInclude(connection, includeName, config.transportRequest),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the include. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const includeName = requireName(config);
    return answering(
      () => activateInclude(connection, includeName),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Lock the include for modification. */
  async lock(config: Partial<IIncludeConfig>): Promise<IAdtResponse<string>> {
    const includeName = requireName(config);
    return answering(
      async () => {
        const { lockHandle } = await inStatefulSession(this.connection, () =>
          lockInclude(this.connection, includeName),
        );
        config.onLock?.(lockHandle);
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

  /** Unlock the include, and go back to stateless either way. */
  /**
   * Close the lock window, and the session mode with it.
   *
   * `lock()` sets stateful; only this puts it back. It did not, and the session
   * stayed stateful for everything that followed — measured the four
   * requests after an include's unlock all went out stateful: the read, the
   * **activation**, the read after it, and the deletion. Every other type here
   * pairs the two calls; this one set stateful and never cleared it.
   *
   * It matters beyond tidiness. An activation inside a stateful session leaves
   * its `E_ABAP_GENPH` on the generated program held by that session, which
   * lives as long as the connection — hours, in a test run — where the same
   * activation sent statelessly leaves nothing behind. Eclipse holds a stateful
   * session for the lock alone: its `LOCK` and `UNLOCK` are on one session and
   * every other request, the source `PUT` included, goes stateless on a session
   * of its own.
   *
   * Cleared after the request, not before: the unlock itself belongs to the
   * window it is closing.
   */
  async unlock(
    config: Partial<IIncludeConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const includeName = requireName(config);
    const answer = await answering(
      () => unlockInclude(this.connection, includeName, lockHandle),
      () => undefined,
    );
    this.connection.setSessionType?.('stateless');
    return answer;
  }
}
