/**
 * AdtBehaviorImplementation - CRUD for a behavior implementation class.
 *
 * A behavior implementation is an ABAP class whose main source carries a
 * `FOR BEHAVIOR OF` clause and whose handler code lives in the implementations
 * include. Everything here is therefore a class request, and this composes
 * `AdtClass` rather than reimplementing it — which is also why it takes
 * `IClassResults`: what it answers is what a class answers.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */

import type {
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
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { getSystemInformation } from '../../utils/systemInfo';
import { AdtClass } from '../class/AdtClass';
import type { LockRegistry } from '../shared/LockRegistry';
import type { ObjectVersion } from '../shared/results';
import type { IReadOptions } from '../shared/types';
import {
  getBehaviorImplementationMetadata,
  getBehaviorImplementationSource,
  getBehaviorImplementationTransport,
} from './read';
import {
  classDocuments,
  type IBehaviorImplementationConfig,
  type IClassResults,
} from './types';
import { updateBehaviorImplementation } from './update';
import { validateBehaviorImplementationName } from './validation';
import {
  getBehaviorImplementationVersionSource,
  getBehaviorImplementationVersions,
} from './versions';

/**
 * The main source a behavior implementation class must carry.
 *
 * The `FOR BEHAVIOR OF` clause is what makes the class an implementation of
 * that definition, and it has to be written before the implementations include
 * is accepted — which is why `update` writes both.
 */
/**
 * The class shell a behavior implementation needs at its own `source/main`,
 * binding it to its behavior definition.
 *
 * Exported because writing it is the caller's: a behavior implementation *is* a
 * class, so the shell goes in with
 * `getClass().update({ className }, { sourceCode })` like any other class
 * source. There used to be an `updateMain()` member here
 * that composed this text and wrote it; it was a second `update` on a type
 * whose two resources are both sources, which is not the shape the atoms name.
 */
export const mainSourceFor = (
  className: string,
  behaviorDefinition: string,
): string =>
  `CLASS ${className} DEFINITION PUBLIC ABSTRACT FINAL FOR BEHAVIOR OF ${behaviorDefinition}.

ENDCLASS.

CLASS ${className} IMPLEMENTATION.

ENDCLASS.`;

export class AdtBehaviorImplementation<
  R extends IClassResults = typeof classDocuments,
> implements
    IAdtCreatable<IBehaviorImplementationConfig, ReturnType<R['created']>>,
    IAdtReadable<IBehaviorImplementationConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<
      IBehaviorImplementationConfig,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<
      Partial<IBehaviorImplementationConfig>,
      ReturnType<R['updated']>
    >,
    IAdtDeletable<
      IBehaviorImplementationConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IBehaviorImplementationConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IBehaviorImplementationConfig, ReturnType<R['check']>>,
    IAdtActivatable<IBehaviorImplementationConfig, ReturnType<R['activation']>>,
    IAdtLockable<IBehaviorImplementationConfig>,
    IAdtTransportAware<IBehaviorImplementationConfig, string>,
    IAdtVersionable<IBehaviorImplementationConfig, ObjectVersion[], string>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly class: AdtClass<R>;
  public readonly objectType: string = 'BehaviorImplementation';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = classDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    // Behavior implementation locks are class locks delegated to this internal
    // AdtClass — pass the session registry so those locks are tracked too, and
    // the caller's result set so what it answers is what this answers.
    this.class = new AdtClass<R>(
      connection,
      logger,
      undefined,
      undefined,
      lockRegistry,
      results,
    );
  }

  /** The class name, or the caller's mistake. */
  private name(config: Partial<IBehaviorImplementationConfig>): string {
    if (!config.className) {
      throw new Error('Class name is required');
    }
    return config.className;
  }

  /** Validate the class name and its behavior definition before creating. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    if (!config.behaviorDefinition) {
      throw new Error('Behavior definition is required for validation');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }

    return answering(
      () =>
        validateBehaviorImplementationName(
          connection,
          name,
          config.packageName as string,
          config.description,
          config.behaviorDefinition,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /**
   * Create the implementation class.
   *
   * The `FOR BEHAVIOR OF` clause is not written here — the class is created
   * plain and `update` writes both sources, because the include the clause
   * refers to does not exist until then.
   */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IBehaviorImplementationConfig, 'sourceCode'> & {
      sourceCode?: never;
    },
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
    if (!config.behaviorDefinition) {
      throw new Error('Behavior definition is required');
    }

    // The system names the author and the master system; a create that guessed
    // either would write the wrong one into the object's own metadata.
    const systemInfo = await getSystemInformation(connection);

    this.logger?.info?.('Creating behavior implementation class');
    return this.class.create(
      {
        className: name,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
        description: config.description,
        masterSystem: systemInfo?.systemID,
        responsible: systemInfo?.userName || '',
      },
      options,
    );
  }

  /** Read the class's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorImplementationConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        getBehaviorImplementationSource(
          connection,
          name,
          version,
          options,
          this.logger,
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the class's metadata document. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        getBehaviorImplementationMetadata(
          connection,
          name,
          options,
          this.logger,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the class belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorImplementationConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        getBehaviorImplementationTransport(
          connection,
          name,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      (answer) => String(answer.data ?? ''),
      options?.analyse,
    );
  }

  /**
   * Write the implementation.
   *
   * Two writes under one lock: the main source with the `FOR BEHAVIOR OF`
   * clause, then the handler code into the implementations include. The main
   * source goes first because the include is only accepted once the class
   * declares which definition it implements.
   *
   * The answer is the include write's — that is the source a caller passed.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    // The source is the caller's, through `options.sourceCode`. This used to
    // read `config.implementationCode` and `config.sourceCode` as well — three
    // channels for one value, of which the contract documents one, and nothing
    // in this repository ever set either config field.
    const source = options?.sourceCode;
    // No `behaviorDefinition` guard: this writes the implementation include and
    // never reads the definition's name. It was required here while `update`
    // also wrote the generated shell, which does mention it — the guard outlived
    // the reason for it and refused a write it had no stake in.
    if (!source) {
      throw new Error('Implementation code is required for update');
    }
    return answering(
      () =>
        updateBehaviorImplementation(
          connection,
          name,
          source,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
      options?.analyse,
    );
  }

  /** Delete the implementation class — the class's own delete, checks and all. */
  /**
   * Ask whether the implementation class can be deleted now.
   *
   * Delegated, like the delete: a behavior implementation *is* its class, and
   * the deletion service is asked about the class's URI.
   */
  async checkDeletion<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    return this.class.checkDeletion(
      {
        className: this.name(config),
        transportRequest: config.transportRequest,
      },
      options,
    );
  }

  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);

    this.logger?.info?.('Deleting behavior implementation class');
    return this.class.delete(
      { className: name, transportRequest: config.transportRequest },
      options,
    );
  }

  /** Activate the implementation class. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    return this.class.activate({ className: this.name(config) }, options);
  }

  /** Check the implementation class. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IBehaviorImplementationConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    return this.class.check({ className: this.name(config) }, status, options);
  }

  /** Lock the class. A behavior implementation has no lock of its own. */
  async lock(
    config: Partial<IBehaviorImplementationConfig>,
  ): Promise<IAdtResponse<string>> {
    return this.class.lock({ className: this.name(config) });
  }

  /** Unlock the class. */
  async unlock(
    config: Partial<IBehaviorImplementationConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    return this.class.unlock({ className: this.name(config) }, lockHandle);
  }

  /** Version history of the implementations include. */
  async getVersions(
    config: Partial<IBehaviorImplementationConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getBehaviorImplementationVersions(this.connection, config),
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
        data: await getBehaviorImplementationVersionSource(
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
