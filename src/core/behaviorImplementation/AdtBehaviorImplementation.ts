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
  IAdtDeletable,
  IAdtLockable,
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
import { getSystemInformation } from '../../utils/systemInfo';
import { AdtClass } from '../class/AdtClass';
import { updateClass } from '../class/update';
import { chain } from '../shared/chain';
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
const mainSourceFor = (className: string, behaviorDefinition: string): string =>
  `CLASS ${className} DEFINITION PUBLIC ABSTRACT FINAL FOR BEHAVIOR OF ${behaviorDefinition}.

ENDCLASS.

CLASS ${className} IMPLEMENTATION.

ENDCLASS.`;

export class AdtBehaviorImplementation<
  R extends IClassResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IClassResults,
> implements
    IAdtCreatable<IBehaviorImplementationConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IBehaviorImplementationConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IBehaviorImplementationConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IBehaviorImplementationConfig, ReturnType<R['deletion']>>,
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
  async validate(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
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
          this.connection,
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
  async create(
    config: IBehaviorImplementationConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
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
    const systemInfo = await getSystemInformation(this.connection);

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
      { ...options, activateOnCreate: false },
    );
  }

  /** Read the class's source. */
  async read(
    config: Partial<IBehaviorImplementationConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    return answering(
      () =>
        getBehaviorImplementationSource(
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

  /** Read the class's metadata document. */
  async readMetadata(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () =>
        getBehaviorImplementationMetadata(
          this.connection,
          name,
          options,
          this.logger,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the class belongs to. */
  async readTransport(
    config: Partial<IBehaviorImplementationConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      () =>
        getBehaviorImplementationTransport(
          this.connection,
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
  async update(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    const name = this.name(config);
    const source =
      options?.sourceCode || config.implementationCode || config.sourceCode;
    if (!config.behaviorDefinition) {
      throw new Error('behaviorDefinition is required for update');
    }
    const behaviorDefinition = config.behaviorDefinition;

    if (options?.lockHandle) {
      if (!source) {
        throw new Error('Implementation code is required for update');
      }
      const lockHandle = options.lockHandle;
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return chain(this.logger, async ({ step }) => {
        await step(
          answering(
            () =>
              updateClass(
                this.connection,
                name,
                mainSourceFor(name, behaviorDefinition),
                lockHandle,
                config.transportRequest,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        return step(
          answering(
            () =>
              updateBehaviorImplementation(
                this.connection,
                name,
                source,
                lockHandle,
                config.transportRequest,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
      });
    }

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      this.logger?.info?.('Step 1: Locking behavior implementation class');
      const lockHandle = await step(this.class.lock({ className: name }));
      const releaseLock = onScopeEnd(async () => {
        await this.class.unlock({ className: name }, lockHandle);
      });
      this.logger?.info?.('Class locked, handle:', lockHandle);

      // Checked without the source: the implementations include is not the
      // full class source, so checking the class *with* it would report
      // syntax errors about code the class does not contain.
      this.logger?.info?.('Step 2: Checking inactive version');
      await step(this.class.check({ className: name }, 'inactive', options));

      this.logger?.info?.(
        'Step 3: Updating main source with FOR BEHAVIOR OF clause',
      );
      await step(
        answering(
          () =>
            updateClass(
              this.connection,
              name,
              mainSourceFor(name, behaviorDefinition),
              lockHandle,
              config.transportRequest,
            ),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );

      let updated = undefined as ReturnType<R['updated']>;
      if (source) {
        this.logger?.info?.('Step 4: Updating implementations include');
        updated = await step(
          answering(
            () =>
              updateBehaviorImplementation(
                this.connection,
                name,
                source,
                lockHandle,
                config.transportRequest,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );

        // The write produced the inactive version; the active one may not exist
        // yet. A failure here is not the update's failure, so it is logged and
        // the chain continues — the unlock still has to happen.
        const ready = await this.read({ className: name }, 'inactive', {
          withLongPolling: true,
        });
        if (!ready.ok) {
          this.logger?.warn?.(
            'read with long polling failed after update:',
            ready.getError().message,
          );
        }
      }

      this.logger?.info?.('Step 5: Unlocking class');
      await step(this.class.unlock({ className: name }, lockHandle));
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();

      this.logger?.info?.('Step 6: Final check');
      await step(this.class.check({ className: name }, 'inactive', options));

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 7: Activating class');
        await step(this.class.activate({ className: name }, options));

        const ready = await this.read({ className: name }, 'active', {
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

  /** Delete the implementation class — the class's own delete, checks and all. */
  async delete(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    const name = this.name(config);

    this.logger?.info?.('Deleting behavior implementation class');
    return this.class.delete(
      { className: name, transportRequest: config.transportRequest },
      options,
    );
  }

  /** Activate the implementation class. */
  async activate(
    config: Partial<IBehaviorImplementationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    return this.class.activate({ className: this.name(config) }, options);
  }

  /** Check the implementation class. */
  async check(
    config: Partial<IBehaviorImplementationConfig>,
    status?: string,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['check']>>> {
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
