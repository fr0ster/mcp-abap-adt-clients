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
  IAnalyse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../utils/activationUtils';
import { answering } from '../../utils/adtResponse';
import { deletionRefusal } from '../../utils/deletionCheck';
import { validationRefusal } from '../../utils/validationRefusal';
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
  R extends IInterfaceResults = typeof interfaceDocuments,
> implements
    IAdtCreatable<IInterfaceConfig, ReturnType<R['created']>>,
    IAdtReadable<IInterfaceConfig, ReturnType<R['source']>>,
    IAdtMetadataReadable<IInterfaceConfig, ReturnType<R['metadata']>>,
    IAdtUpdatable<Partial<IInterfaceConfig>, ReturnType<R['updated']>>,
    IAdtDeletable<
      IInterfaceConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
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
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
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
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the interface. */
  async create<E extends IAdtError = IAdtError>(
    config: IInterfaceConfig,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
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
    return answering(
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
    );
  }

  /** Read the interface's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['source']>, E>> {
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
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
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
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const name = config.interfaceName;
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
        upload(
          this.connection,
          name,
          source,
          options?.lockHandle as string,
          config.transportRequest,
          this.contentTypes?.sourceArtifactContentType(),
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
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const name = config.interfaceName;
    return answering(
      () =>
        checkDeletion(this.connection, {
          interface_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      (options?.analyse ?? deletionRefusal) as IAnalyse<E>,
    );
  }

  /**
   * Delete the interface.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }
    const name = config.interfaceName;
    return answering(
      () =>
        deleteInterface(this.connection, {
          interface_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the interface. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    if (!config.interfaceName) {
      throw new Error('Interface name is required');
    }

    return answering(
      () => activateInterface(this.connection, config.interfaceName as string),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the interface. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
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
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
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
