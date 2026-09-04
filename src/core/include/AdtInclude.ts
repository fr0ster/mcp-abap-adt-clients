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
  IAdtDeletable,
  IAdtLockable,
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
import { chain } from '../shared/chain';
import { activateInclude } from './activation';
import { create } from './create';
import { deleteInclude } from './delete';
import { lockInclude } from './lock';
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

export class AdtInclude<
  R extends IIncludeResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IIncludeResults,
> implements
    IAdtCreatable<IIncludeConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IIncludeConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IIncludeConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IIncludeConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IIncludeConfig, ReturnType<R['validation']>>,
    IAdtActivatable<IIncludeConfig, ReturnType<R['activation']>>,
    IAdtLockable<IIncludeConfig>
{
  constructor(
    private readonly connection: IAbapConnection,
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
  async validate(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
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
        this.connection.makeAdtRequest({
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
  async create(
    config: IIncludeConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
    const includeName = requireName(config);
    if (!config.packageName) {
      throw new Error('packageName is required to create an include');
    }

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      let created = false;
      if (options?.deleteOnFailure) {
        // The object exists from the create on, so a later failure leaves a
        // half-made include behind unless the caller asked otherwise.
        onScopeEnd(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting include after a failed create', {
            includeName,
          });
          await this.delete(config);
        });
      }

      const value = await step(
        answering(
          () =>
            create(
              this.connection,
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
        ),
      );
      created = true;

      // `!== undefined`, not truthiness: `''` is a source, and an empty include
      // is a legitimate object. Treating the empty string as "no source given"
      // makes one valid value unreachable.
      const sourceCode = options?.sourceCode ?? config.sourceCode;
      if (sourceCode !== undefined) {
        await step(this.writeSource(config, sourceCode, options));
        if (options?.activateOnCreate) {
          await step(this.activate(config, options));
        }
      }

      return value;
    });
  }

  /** Read the include's source. */
  async read(
    config: Partial<IIncludeConfig>,
    version?: 'active' | 'inactive',
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const includeName = requireName(config);
    return answering(
      () => getIncludeSource(this.connection, includeName, version),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the include's metadata. */
  async readMetadata(
    config: Partial<IIncludeConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const includeName = requireName(config);
    return answering(
      () => getIncludeMetadata(this.connection, includeName),
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
  async update(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    // Absence, not emptiness: clearing an include to empty is a real edit, and
    // a truthiness check made it impossible to express.
    const sourceCode = options?.sourceCode ?? config.sourceCode;
    if (sourceCode === undefined) {
      throw new Error(
        'sourceCode is required to update an include — pass it in the config or in options',
      );
    }

    if (!options?.activateOnUpdate) {
      return this.writeSource(config, sourceCode, options);
    }

    return chain(this.logger, async ({ step }) => {
      const written = await step(this.writeSource(config, sourceCode, options));
      await step(this.activate(config, options));
      return written;
    });
  }

  /**
   * Delete the include.
   *
   * The unlock afterwards is not tidiness. Measured on E19 (`RFCSAPRL 816`): a
   * successful DELETE does not release the lock with the object — the editing
   * registration on the name stays, and the next create for that name is
   * answered 403 `ExceptionResourceNoAuthorization`, in the same session, on a
   * name nothing else had touched.
   *
   * A refused unlock after a successful delete is logged, not returned: the
   * object is gone, so it is not a failure of the delete — which is exactly
   * what `chain` does with a cleanup that throws.
   */
  async delete(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    const includeName = requireName(config);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      this.connection.setSessionType?.('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType?.('stateless');
      });

      const locked = await lockInclude(this.connection, includeName);
      onScopeEnd(async () => {
        await unlockInclude(this.connection, includeName, locked.lockHandle);
      });
      config.onLock?.(locked.lockHandle);

      return step(
        answering(
          () =>
            deleteInclude(
              this.connection,
              includeName,
              locked.lockHandle,
              config.transportRequest ?? locked.corrNr,
            ),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
    });
  }

  /** Activate the include. */
  async activate(
    config: Partial<IIncludeConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    const includeName = requireName(config);
    return answering(
      () => activateInclude(this.connection, includeName),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Lock the include for modification. */
  async lock(config: Partial<IIncludeConfig>): Promise<IAdtResponse<string>> {
    const includeName = requireName(config);
    return answering(
      async () => {
        this.connection.setSessionType?.('stateful');
        const { lockHandle } = await lockInclude(this.connection, includeName);
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
  async unlock(
    config: Partial<IIncludeConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const includeName = requireName(config);
    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType?.('stateless');
      });
      await step(
        answering(
          () => unlockInclude(this.connection, includeName, lockHandle),
          () => undefined,
        ),
      );
    });
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
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    const includeName = requireName(config);
    const borrowed = options?.lockHandle;

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      let lockHandle = borrowed;
      let corrNr: string | undefined;

      if (!borrowed) {
        this.connection.setSessionType?.('stateful');
        onScopeEnd(async () => {
          this.connection.setSessionType?.('stateless');
        });
        const locked = await lockInclude(this.connection, includeName);
        lockHandle = locked.lockHandle;
        corrNr = locked.corrNr;
        config.onLock?.(lockHandle);
        onScopeEnd(async () => {
          // Audible when it fails: a lock left behind is what makes the next
          // create for this name answer 403 with nothing appearing to hold it.
          await unlockInclude(
            this.connection,
            includeName,
            lockHandle as string,
          );
        });
      }

      return step(
        answering(
          () =>
            uploadIncludeSource(
              this.connection,
              includeName,
              sourceCode,
              lockHandle as string,
              config.transportRequest ?? corrNr,
            ),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );
    });
  }
}
