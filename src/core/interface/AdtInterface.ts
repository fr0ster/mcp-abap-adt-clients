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
  IAdtActivatable,
  IAdtAnalyseOptions,
  IAdtCheckable,
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
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import { nothing } from '../../utils/resultStrategy';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
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
    IAdtVersionable<
      IInterfaceConfig,
      ReturnType<R['versions']>,
      ReturnType<R['versionSource']>
    >
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        validateInterfaceName(
          connection,
          config.interfaceName as string,
          config.packageName as string,
          config.description,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse,
    );
  }

  /** Create the interface. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IInterfaceConfig, 'source'> & { source?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    // **The one guard this package keeps, and only on a create.**
    //
    // An object created without a package is the single thing `delete()` cannot
    // undo: the deletion check resolves through the package, so it answers
    // "Object does not exist" while the name stays taken for good, and clearing
    // it is SAP GUI territory. Everywhere else a missing field produces a
    // request the server answers, which is a reading a strategy can take. Here
    // it produces a state with no way out through ADT at all.
    if (!config.packageName) {
      throw new Error(
        'packageName is required for create: an object created without one cannot be deleted through ADT',
      );
    }

    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName as string;
    return answering(
      () =>
        createInterface(
          connection,
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, and whether that *is* absence is the caller's reading.
    return answering(
      () =>
        getInterfaceSource(
          connection,
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getInterfaceMetadata(
          connection,
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
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async update<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['updated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName as string;
    // The source is the caller's, through `options.source`. This used to
    // fall back to `config.source` — two channels for one value, where the
    // contract documents one. `config.source` is `check`'s alone now: a
    // syntax check compiles a source that is not on the server yet, so it has
    // nowhere else to arrive.
    const source = options?.source;

    return answering(
      () =>
        upload(
          connection,
          name,
          source as string,
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName as string;
    return answering(
      () =>
        checkDeletion(connection, {
          interface_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck as IResultStrategy<
        ReturnType<R['deletionCheck']>
      >,
      options?.analyse,
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName as string;
    return answering(
      () =>
        deleteInterface(connection, {
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () => activateInterface(connection, config.interfaceName as string),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Check the interface. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkInterface(
          connection,
          config.interfaceName as string,
          version,
          config.source,
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
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getInterfaceTransport(
          connection,
          config.interfaceName as string,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /**
   * Lock the interface — one LOCK, its handle read by `lockHandleOf`. A 200
   * carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const name = config.interfaceName as string;
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockInterface(this.connection, name),
        ),
      lockHandleOf,
      options?.analyse,
    );
    if (answer.ok && answer.getResult().value) {
      this.lockTracker.track(name, answer.getResult().value);
    }
    return answer;
  }

  /** Unlock the interface. */
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    const name = config.interfaceName as string;

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        const result = await inStatefulSession(this.connection, () =>
          unlockInterface(this.connection, name, lockHandle),
        );
        this.lockTracker.untrack(name);
        return result;
      },
      nothing,
      options?.analyse,
    );
  }

  /** Version history of the interface's source. */
  async getVersions<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['versions']>, E>> {
    return answering(
      () => getInterfaceVersions(this.connection, config),
      this.results.versions as IResultStrategy<ReturnType<R['versions']>>,
      options?.analyse,
    );
  }

  /** Source of one version, by the `contentUri` its entry carried. */
  async getVersionSource<E extends IAdtError = IAdtError>(
    contentUri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['versionSource']>, E>> {
    return answering(
      () => getInterfaceVersionSource(this.connection, contentUri),
      this.results.versionSource as IResultStrategy<
        ReturnType<R['versionSource']>
      >,
      options?.analyse,
    );
  }
}
