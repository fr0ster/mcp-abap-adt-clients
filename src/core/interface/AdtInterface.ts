/**
 * AdtInterface - CRUD for `INTF/OI` interfaces.
 *
 * Every member answers `IAdtResponse<T>`, where T is whatever the result set
 * given at construction makes of that endpoint's answer. What runs before the
 * member's own request — a lock, a check — is this implementation's business
 * and is not in the answer: only its failures are.
 *
 * Operation chains:
 * - Create: create
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
import { answering } from '../../utils/adtResponse';
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
import { activateInterface } from './activation';
import { checkInterface } from './check';
import { create as createInterface } from './create';
import { checkDeletion, deleteInterface } from './delete';
import { lockInterface } from './lock';
import {
  getInterfaceMetadata,
  getInterfaceSource,
  getInterfaceTransport,
} from './read';
import {
  type IInterfaceConfig,
  type IInterfaceResults,
  interfaceDocuments,
} from './types';
import { unlockInterface } from './unlock';
import { upload } from './update';
import { validateInterfaceName } from './validation';
import { getInterfaceVersionSource, getInterfaceVersions } from './versions';

export class AdtInterface<
  R extends IInterfaceResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IInterfaceResults,
> implements
    IAdtCreatable<IInterfaceConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IInterfaceConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IInterfaceConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IInterfaceConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IInterfaceConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IInterfaceConfig, ReturnType<R['check']>>,
    IAdtActivatable<IInterfaceConfig, ReturnType<R['activation']>>,
    IAdtLockable<IInterfaceConfig>,
    IAdtTransportAware<IInterfaceConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IInterfaceConfig, ObjectVersion[], string>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Interface';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    contentTypes?: IAdtContentTypes,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default. See AdtClass.
    protected readonly results: R = interfaceDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.contentTypes = contentTypes;
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (interfaceName, lockHandle) =>
        unlockInterface(this.connection, interfaceName, lockHandle),
    );
  }

  /** Validate an interface name before creating it. */
  async validate(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required for validation');
    }
    if (!config.packageName) {
      throw new Error('Package name is required for validation');
    }

    return answering(
      () =>
        validateInterfaceName(
          this.connection,
          config.interfaceName as string,
          config.packageName as string,
          config.description,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the interface. */
  async create(
    config: IInterfaceConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    const name = config.interfaceName;

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting interface after failure');
          this.connection.setSessionType('stateful');
          await deleteInterface(this.connection, {
            interface_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Creating interface');
      const value = await step(
        answering(
          () =>
            createInterface(
              this.connection,
              {
                interfaceName: name,
                packageName: config.packageName as string,
                transportRequest: config.transportRequest,
                description: config.description as string,
                masterSystem: this.systemContext.masterSystem,
                responsible: this.systemContext.responsible,
                masterLanguage:
                  config.masterLanguage ?? this.systemContext.masterLanguage,
              },
              this.logger,
            ),
          this.results.created as IResultStrategy<ReturnType<R['created']>>,
          options?.analyse,
        ),
      );
      // Only past the step: a refused create leaves nothing to delete.
      created = true;
      this.logger?.info?.('Interface created');
      return value;
    });
  }

  /** Read the interface's source. */
  async read(
    config: Partial<IInterfaceConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, and whether that *is* absence is the caller's reading.
    return answering(
      () =>
        getInterfaceSource(
          this.connection,
          config.interfaceName as string,
          version,
          options,
        ),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the interface's metadata. */
  async readMetadata(
    config: Partial<IInterfaceConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    return answering(
      () =>
        getInterfaceMetadata(
          this.connection,
          config.interfaceName as string,
          options,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /**
   * Write the interface's source.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain, so
   * this is one request. Without it, this locks, checks, writes and unlocks —
   * and the unlock happens on every path out.
   */
  async update(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const name = config.interfaceName;
    const source = options?.sourceCode || config.sourceCode;

    if (options?.lockHandle) {
      if (!source) {
        throw new Error('Source code is required for update');
      }
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      return answering(
        () =>
          upload(
            this.connection,
            name,
            source,
            options.lockHandle as string,
            config.transportRequest,
            this.contentTypes?.sourceArtifactContentType(),
          ),
        this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
        options?.analyse,
      );
    }

    // A LOCK…UNLOCK window: a timeout in the middle releases the lock and
    // leaves the work half done.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Step 1: Locking interface');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: a handle is only valid inside a
      // stateful request on older BASIS (#106).
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const { lockHandle } = await lockInterface(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockInterface(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Interface locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () =>
              checkInterface(
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
        this.logger?.info?.('Step 3: Updating interface');
        updated = await step(
          answering(
            () =>
              upload(
                this.connection,
                name,
                source,
                lockHandle,
                config.transportRequest,
                this.contentTypes?.sourceArtifactContentType(),
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        this.logger?.info?.('Interface updated');

        // The write produced the inactive version; the active one may not exist
        // yet. A failure here is not the update's failure, so it is logged and
        // the chain continues — the unlock still has to happen.
        const ready = await this.read({ interfaceName: name }, 'inactive', {
          withLongPolling: true,
        });
        if (!ready.ok) {
          this.logger?.warn?.(
            'read with long polling failed after update:',
            ready.getError().message,
          );
        }
      }

      this.logger?.info?.('Step 4: Unlocking interface');
      this.connection.setSessionType('stateful');
      await unlockInterface(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      releaseLock();
      this.logger?.info?.('Interface unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () =>
            checkInterface(
              this.connection,
              name,
              'inactive',
              undefined,
              this.contentTypes?.sourceArtifactContentType(),
            ),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating interface');
        await step(
          answering(
            () => activateInterface(this.connection, name),
            this.results.activation as IResultStrategy<
              ReturnType<R['activation']>
            >,
            options?.analyse ?? activationRefusal,
          ),
        );

        const ready = await this.read({ interfaceName: name }, 'active', {
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
   * Delete the interface.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  async delete(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const name = config.interfaceName;

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      this.logger?.info?.('Checking interface for deletion');
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              interface_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse ?? deletionRefusal,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      this.logger?.info?.('Deleting interface');
      this.connection.setSessionType('stateful');
      const value = await step(
        answering(
          () =>
            deleteInterface(this.connection, {
              interface_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Interface deleted');
      return value;
    });
  }

  /** Activate the interface. Needs no stateful session. */
  async activate(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    return answering(
      () => activateInterface(this.connection, config.interfaceName as string),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse ?? activationRefusal,
    );
  }

  /** Check the interface. */
  async check(
    config: Partial<IInterfaceConfig>,
    status?: string,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['check']>>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkInterface(
          this.connection,
          config.interfaceName as string,
          version,
          config.sourceCode,
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** The transport request the interface belongs to. */
  async readTransport(
    config: Partial<IInterfaceConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['transport']>>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    return answering(
      () =>
        getInterfaceTransport(
          this.connection,
          config.interfaceName as string,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /** Lock the interface for modification. */
  async lock(config: Partial<IInterfaceConfig>): Promise<IAdtResponse<string>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const name = config.interfaceName;

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const { lockHandle } = await lockInterface(this.connection, name);
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

  /** Unlock the interface. */
  async unlock(
    config: Partial<IInterfaceConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const name = config.interfaceName;

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        const result = await unlockInterface(this.connection, name, lockHandle);
        this.connection.setSessionType('stateless');
        this.lockTracker.untrack(name);
        return result;
      },
      () => undefined,
    );
  }

  /** Version history of the interface's source. */
  async getVersions(
    config: Partial<IInterfaceConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getInterfaceVersions(this.connection, config),
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
        data: await getInterfaceVersionSource(this.connection, contentUri),
        status: 200,
        statusText: 'OK',
        headers: {},
      }),
      (answer) => String(answer.data),
    );
  }
}
