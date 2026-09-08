/**
 * AdtScalarFunction - CRUD for `DSFD/DSF` scalar function definitions.
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
  IAdtWireResponse,
  IAnalyse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE, AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../utils/activationUtils';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { deletionRefusal } from '../../utils/deletionCheck';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import { activateScalarFunction } from './activation';
import { checkScalarFunction } from './check';
import { create as createScalarFunction } from './create';
import { checkDeletion, deleteScalarFunction } from './delete';
import { lockScalarFunction } from './lock';
import {
  getScalarFunction,
  getScalarFunctionSource,
  getScalarFunctionTransport,
} from './read';
import {
  type IScalarFunctionConfig,
  type IScalarFunctionResults,
  scalarFunctionDocuments,
} from './types';
import { unlockScalarFunction } from './unlock';
import { updateScalarFunction } from './update';
import { validateScalarFunctionName } from './validation';
import {
  getScalarFunctionVersionSource,
  getScalarFunctionVersions,
} from './versions';

/** Statuses that mean the system has no validation resource, not a bad name. */
const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

/**
 * The shipped reading of a validation answer this system may not offer.
 *
 * Measured: some systems answer 404, 405 or 501 for the scalar-function
 * validation resource. That is not a verdict about the name — it comes back as
 * a failure named {@link AdtObjectErrorCodes.UNSUPPORTED_OPERATION}, so a
 * consumer branches on the code rather than on a status.
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
        message: `This system does not offer scalar-function name validation (HTTP ${status})`,
      }
    : verdict;
};

export class AdtScalarFunction<
  R extends IScalarFunctionResults = typeof scalarFunctionDocuments,
> implements
    IAdtCreatable<IScalarFunctionConfig, ReturnType<R['created']>>,
    IAdtReadable<IScalarFunctionConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IScalarFunctionConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<IScalarFunctionConfig>, ReturnType<R['updated']>>,
    IAdtDeletable<
      IScalarFunctionConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IScalarFunctionConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IScalarFunctionConfig, ReturnType<R['check']>>,
    IAdtActivatable<IScalarFunctionConfig, ReturnType<R['activation']>>,
    IAdtLockable<IScalarFunctionConfig>,
    IAdtTransportAware<IScalarFunctionConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IScalarFunctionConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'ScalarFunction';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = scalarFunctionDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockScalarFunction(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IScalarFunctionConfig>): string {
    if (!config.scalarFunctionName) {
      throw new Error('Scalar function name is required');
    }
    return config.scalarFunctionName;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => validateScalarFunctionName(connection, name, config.description),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      (options?.analyse ?? validationUnsupported) as IAnalyse<E>,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IScalarFunctionConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    return answering(
      () =>
        createScalarFunction(connection, {
          scalar_function_name: name,
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
    );
  }

  /** Read the object. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () =>
        getScalarFunctionSource(connection, name, version ?? 'active', options),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        getScalarFunction(
          connection,
          name,
          options?.version ?? 'active',
          options,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        getScalarFunctionTransport(
          connection,
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
    config: Partial<IScalarFunctionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    // The source is the caller's, through `options.sourceCode`. This used to
    // fall back to `config.sourceCode` — two channels for one value, where the
    // contract documents one. `config.sourceCode` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.sourceCode;

    if (!source) {
      throw new Error('Source code is required for update');
    }
    return answering(
      () =>
        updateScalarFunction(
          connection,
          {
            scalar_function_name: name,
            source_code: source as string,
            transport_request: config.transportRequest,
          },
          options?.lockHandle,
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
    config: Partial<IScalarFunctionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(connection, {
          scalar_function_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
    );
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
    config: Partial<IScalarFunctionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        deleteScalarFunction(connection, {
          scalar_function_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => activateScalarFunction(connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IScalarFunctionConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkScalarFunction(connection, name, version, config.sourceCode),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IScalarFunctionConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        const lockHandle = await inStatefulSession(this.connection, () =>
          lockScalarFunction(this.connection, name),
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
    config: Partial<IScalarFunctionConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockScalarFunction(this.connection, name, lockHandle);
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
    config: Partial<IScalarFunctionConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getScalarFunctionVersions(this.connection, config),
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
        data: await getScalarFunctionVersionSource(this.connection, contentUri),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => String(answer.data),
    );
  }
}
