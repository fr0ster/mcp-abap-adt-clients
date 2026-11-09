import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
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
  AdtVariant,
  IAdtActivatable,
  IAdtActivationOptions,
  IAdtAnalyseOptions,
  IAdtCheckable,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtError,
  IAdtHeaders,
  IAdtLockable,
  IAdtMetadataReadable,
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtUpdateOptions,
  IAdtValidatable,
  IAdtVersionable,
  IInterfaceResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
import { INTERFACE } from '../../endpoints/objects';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import {
  nothing,
  type ResultStrategiesOf,
  type ResultValuesOf,
} from '../../utils/resultStrategy';
import { createLanguage } from '../../utils/xml';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import { writeObjectDocument } from '../shared/documentWrite';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import { createLockTracker, type LockTracker } from '../shared/LockRegistry';
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
import type { IInterfaceConfig, interfaceDocuments } from './types';
import { unlockInterface } from './unlock';
import { upload } from './update';
import { validateInterfaceName } from './validation';
import { getInterfaceVersionSource, getInterfaceVersions } from './versions';

/** What each slot of the result set answers. */
export type InterfaceValues = {
  readonly [K in keyof IInterfaceResults]: unknown;
};

export class AdtInterface<
  T extends InterfaceValues = ResultValuesOf<typeof interfaceDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtCreatable<IInterfaceConfig, T['created']>,
    IAdtReadable<IInterfaceConfig, T['source']>,
    IAdtMetadataReadable<IInterfaceConfig, T['metadata']>,
    IAdtUpdatable<Partial<IInterfaceConfig>, T['updated']>,
    IAdtMetadataUpdatable<Partial<IInterfaceConfig>, T['metadataUpdated']>,
    IAdtDeletable<IInterfaceConfig, T['deletion'], T['deletionCheck']>,
    IAdtValidatable<IInterfaceConfig, T['validation']>,
    IAdtCheckable<IInterfaceConfig, T['check']>,
    IAdtActivatable<IInterfaceConfig, T['activation']>,
    IAdtLockable<IInterfaceConfig>,
    IAdtTransportAware<IInterfaceConfig, T['transport']>,
    IAdtVersionable<IInterfaceConfig, T['versions'], T['versionSource']>
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  protected readonly contentTypes?: IAdtContentTypes;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'Interface';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'systemContext' | 'contentTypes' | 'lockRegistry'
    >,
  ) {
    const { logger, systemContext, contentTypes, lockRegistry } = options;
    this.results = options.results;
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
  ): Promise<IAdtResponse<T['validation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        validateInterfaceName(
          connection,
          config.interfaceName as string,
          config.packageName ?? '',
          config.description,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the interface. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IInterfaceConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E>> {
    // **The one guard this package keeps, and only on a create.**
    //
    // The type requires a package; this refuses an empty one, which the type
    // cannot rule out. SAP creates nothing without a package: most creates are
    // refused (CTS_WBO_API 018, "Object cannot be created without a package"),
    // and a message class is answered 201 Created with nothing created (read on
    // premise, 2026-11-02). Refused here, before any request, in words that say
    // why.
    if (!config.packageName) {
      throw new Error(
        'packageName is required for create: SAP creates nothing without one',
      );
    }

    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName as string;
    return answering(
      () =>
        createInterface(
          connection,
          options.headers,
          {
            interfaceName: name,
            packageName: config.packageName,
            transportRequest: config.transportRequest,
            description: config.description as string,
            masterSystem: this.systemContext.masterSystem,
            responsible: this.systemContext.responsible,
            masterLanguage: createLanguage(
              config.masterLanguage,
              this.systemContext.masterLanguage,
            ),
          },
          this.logger,
        ),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the interface's source. */
  async read<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E>> {
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
      this.results.source,
      options?.analyse,
    );
  }

  /** Read the interface's metadata. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getInterfaceMetadata(
          connection,
          config.interfaceName as string,
          options,
        ),
      this.results.metadata,
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
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['updated'], E>> {
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
          options.headers,
          options.ifMatch,
          name,
          source as string,
          options?.lockHandle as string,
          config.transportRequest,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Write the interface's metadata document — one PUT of `options.source`, as
   * the caller built it, under the caller's `options.lockHandle` (and
   * `config.transportRequest` as `corrNr`), with the caller's headers.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds (`readMetadata`), change what you mean to change,
   * and pass the result: anything left out is gone, because nothing is read
   * here to keep it.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'interface', 'updateMetadata'>,
    config: Partial<IInterfaceConfig>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        writeObjectDocument(
          connection,
          options.headers,
          options.ifMatch,
          INTERFACE.uri(config.interfaceName as string),
          options?.source as string,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.metadataUpdated,
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
    this: this & AdtPerformedBy<'interface', 'deletionCheck'>,
    config: Partial<IInterfaceConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName as string;
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          interface_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck,
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
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.interfaceName as string;
    return answering(
      () =>
        deleteInterface(connection, options.headers, {
          interface_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the interface. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        activateInterface(
          connection,
          options.headers,
          config.interfaceName as string,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Check the interface. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IInterfaceConfig>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkInterface(
          connection,
          options.headers,
          config.interfaceName as string,
          version,
          config.source,
          this.contentTypes?.sourceArtifactContentType(),
        ),
      this.results.check,
      options?.analyse,
    );
  }

  /** The transport request the interface belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'interface', 'transport'>,
    config: Partial<IInterfaceConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E>> {
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
      this.results.transport,
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
  ): Promise<IAdtResponse<T['versions'], E>> {
    return answering(
      () => getInterfaceVersions(this.connection, config),
      this.results.versions,
      options?.analyse,
    );
  }

  /** Source of one version, by the `contentUri` its entry carried. */
  async getVersionSource<E extends IAdtError = IAdtError>(
    contentUri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versionSource'], E>> {
    return answering(
      () => getInterfaceVersionSource(this.connection, contentUri),
      this.results.versionSource,
      options?.analyse,
    );
  }
}
