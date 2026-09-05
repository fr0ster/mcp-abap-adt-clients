/**
 * AdtScalarFunctionImplementation - CRUD for `DSFI/DSF` scalar function
 * implementations.
 *
 * Asymmetric by the endpoint's design: the source is JSON on `/source/main`,
 * the metadata is blues v2 XML on `/dsfi/{name}`. `update` writes the source;
 * `updateMetadata` writes the other.
 *
 * Activation is the consumer's to orchestrate — definition, AMDP class and
 * implementation activate as a group, and this one alone is refused.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */
import type {
  AdtNoFailure,
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
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
  IAdtWireResponse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE, AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
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
import { activateScalarFunctionImplementation } from './activation';
import { checkScalarFunctionImplementation } from './check';
import { create as createScalarFunctionImplementation } from './create';
import { checkDeletion, deleteScalarFunctionImplementation } from './delete';
import { lockScalarFunctionImplementation } from './lock';
import {
  getScalarFunctionImplementation,
  getScalarFunctionImplementationSource,
  getScalarFunctionImplementationTransport,
} from './read';
import {
  type IScalarFunctionImplementationConfig,
  type IScalarFunctionImplementationResults,
  scalarFunctionImplementationDocuments,
} from './types';
import { unlockScalarFunctionImplementation } from './unlock';
import { updateScalarFunctionImplementation } from './update';
import { updateScalarFunctionImplementationMetadata } from './updateMetadata';
import { validateScalarFunctionImplementationName } from './validation';
import {
  getScalarFunctionImplementationVersionSource,
  getScalarFunctionImplementationVersions,
} from './versions';

/** Statuses that mean the system has no validation resource, not a bad name. */
const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

/**
 * The shipped reading of a validation answer this system may not offer.
 *
 * Measured: some systems answer 404, 405 or 501 for the DSFI validation
 * resource. That is not a verdict about the name — it comes back as a failure
 * named {@link AdtObjectErrorCodes.UNSUPPORTED_OPERATION}, so a consumer
 * branches on the code rather than on a status. The same reading the scalar
 * function and the append structure ship, for the same measured reason.
 */
export const validationUnsupported = (
  verdict: IAdtError | AdtNoFailure,
  answer?: IAdtWireResponse,
): IAdtError | AdtNoFailure => {
  if (verdict === ADT_NO_FAILURE) return ADT_NO_FAILURE;
  const status = verdict.response?.status ?? answer?.status;
  return status && VALIDATION_UNSUPPORTED_STATUSES.has(status)
    ? {
        ...verdict,
        code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
        message: `This system does not offer scalar-function-implementation name validation (HTTP ${status})`,
      }
    : verdict;
};

export class AdtScalarFunctionImplementation<
  R extends IScalarFunctionImplementationResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IScalarFunctionImplementationResults,
> implements
    IAdtCreatable<
      IScalarFunctionImplementationConfig,
      ReturnType<R['created']>
    >,
    IAdtReadable<
      IScalarFunctionImplementationConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<
      IScalarFunctionImplementationConfig,
      ReturnType<R['updated']>
    >,
    IAdtDeletable<
      IScalarFunctionImplementationConfig,
      ReturnType<R['deletion']>
    >,
    IAdtValidatable<
      IScalarFunctionImplementationConfig,
      ReturnType<R['validation']>
    >,
    IAdtCheckable<IScalarFunctionImplementationConfig, ReturnType<R['check']>>,
    IAdtActivatable<
      IScalarFunctionImplementationConfig,
      ReturnType<R['activation']>
    >,
    IAdtLockable<IScalarFunctionImplementationConfig>,
    IAdtTransportAware<
      IScalarFunctionImplementationConfig,
      ReturnType<R['transport']>
    >,
    IAdtVersionable<
      IScalarFunctionImplementationConfig,
      ObjectVersion[],
      string
    >
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'ScalarFunctionImplementation';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = scalarFunctionImplementationDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockScalarFunctionImplementation(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IScalarFunctionImplementationConfig>): string {
    if (!config.implementationName) {
      throw new Error('Implementation name is required');
    }
    return config.implementationName;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);

    return answering(
      () =>
        validateScalarFunctionImplementationName(
          this.connection,
          name,
          config.description,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      (options?.analyse ?? validationUnsupported) as IAnalyse<E>,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: IScalarFunctionImplementationConfig,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    const name = this.name(config);
    if (!config.scalarFunctionName) {
      throw new Error('Scalar function name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure ?? true) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.(
            'Deleting scalar function implementation after failure',
          );
          await deleteScalarFunctionImplementation(this.connection, {
            implementation_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Creating scalar function implementation');
      const value = await step(
        answering(
          () =>
            createScalarFunctionImplementation(this.connection, {
              implementation_name: name,
              scalar_function_name: config.scalarFunctionName as string,
              engine_value: config.engineValue,
              package_name: config.packageName as string,
              transport_request: config.transportRequest,
              description: config.description as string,
              masterSystem: this.systemContext.masterSystem,
              responsible: this.systemContext.responsible,
              masterLanguage:
                config.masterLanguage ?? this.systemContext.masterLanguage,
            }),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      // Only past the step: a refused create leaves nothing to delete, and the
      // cleanup above must not remove an object this call did not make.
      created = true;
      this.logger?.info?.('Scalar function implementation created');
      return value;
    });
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionImplementationConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () =>
        getScalarFunctionImplementationSource(
          this.connection,
          name,
          version,
          options,
          this.logger,
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IReadOptions & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const name = this.name(config);

    return answering(
      () =>
        getScalarFunctionImplementation(
          this.connection,
          name,
          options?.version ?? 'inactive',
          options,
          this.logger,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: { withLongPolling?: boolean } & IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    const name = this.name(config);

    return answering(
      () =>
        getScalarFunctionImplementationTransport(
          this.connection,
          name,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /**
   * Write the object.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain, so
   * this is one request. Without it, this locks, checks, writes and unlocks —
   * and the unlock happens on every path out.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    const name = this.name(config);
    const source = options?.sourceCode || config.sourceCode;

    if (options?.lockHandle) {
      const lockHandle = options.lockHandle;
      if (!source) {
        throw new Error('Source code is required for update');
      }
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          updateScalarFunctionImplementation(
            this.connection,
            {
              implementation_name: name,
              source_code: source as string,
              transport_request: config.transportRequest,
            },
            lockHandle,
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

      this.logger?.info?.('Step 1: Locking scalar function implementation');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: on older BASIS a lock handle is
      // only valid inside a stateful request, so going stateless before the
      // unlock would break the unlock (#106); and if the lock itself throws,
      // the session is still restored.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockScalarFunctionImplementation(
        this.connection,
        name,
      );
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockScalarFunctionImplementation(
          this.connection,
          name,
          lockHandle,
        );
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.(
        'Scalar function implementation locked, handle:',
        lockHandle,
      );

      // No check before the write. A DSFI's source is JSON and the check run
      // applies to the activated trio, not to source it has not seen yet.

      let updated = undefined as ReturnType<R['updated']>;
      if (source) {
        this.logger?.info?.('Step 3: Updating scalar function implementation');
        updated = await step(
          answering(
            () =>
              updateScalarFunctionImplementation(
                this.connection,
                {
                  implementation_name: name,
                  source_code: source as string,
                  transport_request: config.transportRequest,
                },
                lockHandle,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        this.logger?.info?.('Scalar function implementation updated');

        // No readiness poll here, unlike every neighbouring handler. The DSFI
        // source resource is JSON on `/source/main` and was never measured to
        // long-poll; a GET added by pattern would be a request nobody has seen
        // this endpoint answer.
      }

      this.logger?.info?.('Step 4: Unlocking scalar function implementation');
      this.connection.setSessionType('stateful');
      await unlockScalarFunctionImplementation(
        this.connection,
        name,
        lockHandle,
      );
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();
      this.logger?.info?.('Scalar function implementation unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () =>
            checkScalarFunctionImplementation(
              this.connection,
              name,
              'inactive',
            ),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.(
          'Step 6: Activating scalar function implementation',
        );
        await step(
          answering(
            () => activateScalarFunctionImplementation(this.connection, name),
            this.results.activation as IResultStrategy<
              ReturnType<R['activation']>
            >,
            (options?.analyse ?? activationRefusal) as IAnalyse<E>,
          ),
        );

        const ready = await this.read(config, 'active', {
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
   * Write the implementation's **metadata** — blues v2 XML on `/dsfi/{name}`,
   * a different resource from the JSON source `update` writes.
   *
   * The same lock window, for the same reason.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const name = this.name(config);
    const source = options?.sourceCode ?? config.sourceCode;
    if (!source) {
      throw new Error('Source code is required for updateMetadata');
    }

    if (options?.lockHandle) {
      return answering(
        () =>
          updateScalarFunctionImplementationMetadata(
            this.connection,
            {
              implementation_name: name,
              source_code: source,
              transport_request: config.transportRequest,
            },
            options.lockHandle as string,
          ),
        this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
        options?.analyse,
      );
    }

    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.connection.setSessionType('stateful');
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockScalarFunctionImplementation(
        this.connection,
        name,
      );
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockScalarFunctionImplementation(
          this.connection,
          name,
          lockHandle,
        );
        this.lockTracker.untrack(name);
      });

      const written = await step(
        answering(
          () =>
            updateScalarFunctionImplementationMetadata(
              this.connection,
              {
                implementation_name: name,
                source_code: source,
                transport_request: config.transportRequest,
              },
              lockHandle,
            ),
          this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
          options?.analyse,
        ),
      );

      await unlockScalarFunctionImplementation(
        this.connection,
        name,
        lockHandle,
      );
      this.lockTracker.untrack(name);
      releaseLock();

      return written;
    });
  }

  /**
   * Delete the object.
   *
   * The deletion check is read, not merely performed: ADT answers a refusal
   * with `del:isDeletable="false"` inside a 200, and a delete that ignored it
   * reported success while the object stayed. {@link deletionRefusal} is the
   * shipped reading of that answer; a caller who wants another passes their own
   * `analyse`.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.(
        'Checking scalar function implementation for deletion',
      );
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              implementation_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting scalar function implementation');
      const value = await step(
        answering(
          () =>
            deleteScalarFunctionImplementation(this.connection, {
              implementation_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Scalar function implementation deleted');
      return value;
    });
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionImplementationConfig>,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const name = this.name(config);

    return answering(
      () => activateScalarFunctionImplementation(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionImplementationConfig>,
    status?: string,
    options?: IAdtOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkScalarFunctionImplementation(this.connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IScalarFunctionImplementationConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockScalarFunctionImplementation(
          this.connection,
          name,
        );
        this.lockTracker.track(name, lockHandle);
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

  /** Unlock the object. */
  async unlock(
    config: Partial<IScalarFunctionImplementationConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockScalarFunctionImplementation(
            this.connection,
            name,
            lockHandle,
          );
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      () => undefined,
    );
  }

  /** Version history of the object's source. */
  async getVersions(
    config: Partial<IScalarFunctionImplementationConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getScalarFunctionImplementationVersions(
          this.connection,
          config,
        ),
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
        data: await getScalarFunctionImplementationVersionSource(
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
