import type {
  AdtReadVersion,
  AdtRequiredUpdateOptions,
  IAdtLockedWrite,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
/**
 * AdtFunctionGroup - CRUD for `FUGR/F` function groups.
 *
 * A function group is a container whose own source is the function pool's main
 * program: `read` / `update` read and write it; `readMetadata` /
 * `updateMetadata` are its metadata document.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 *
 * Operation chains:
 * - Create: validate → create → check → activate (optional)
 * - Update: lock → update → unlock → check → activate (optional)
 * - Delete: check(deletion) → delete
 */

import type {
  AdtObjectIdentity,
  AdtVariant,
  IAdtActivatable,
  IAdtActivationOptions,
  IAdtAnalyseOptions,
  IAdtCheckable,
  IAdtContentTypes,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtDeletable,
  IAdtEnhancementHost,
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
  IFunctionGroupResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant, AdtPerformedBy } from '../../clients/variant';
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
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import {
  createLockTracker,
  failedWireStatus,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateFunctionGroup } from './activation';
import { checkFunctionGroup } from './check';
import { create as createFunctionGroup } from './create';
import { checkDeletion, deleteFunctionGroup } from './delete';
import {
  getFunctionGroupEnhancementElements,
  getFunctionGroupEnhancementOptions,
} from './enhancements';
import { lockFunctionGroup } from './lock';
import {
  getFunctionGroup,
  getFunctionGroupSource,
  getFunctionGroupTransport,
} from './read';
import type { functionGroupDocuments, IFunctionGroupConfig } from './types';
import { unlockFunctionGroup } from './unlock';
import { updateFunctionGroup, uploadFunctionGroupSource } from './update';
import { validateFunctionGroupName } from './validation';

/** What each slot of the result set answers. */
export type FunctionGroupValues = {
  readonly [K in keyof IFunctionGroupResults]: unknown;
};

export class AdtFunctionGroup<
  T extends FunctionGroupValues = ResultValuesOf<typeof functionGroupDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtEnhancementHost<
      IFunctionGroupConfig,
      T['enhancementElements'],
      T['enhancementOptions'],
      'functionGroupName'
    >,
    IAdtCreatable<IFunctionGroupConfig, T['created']>,
    IAdtReadable<IFunctionGroupConfig, T['source'], 'functionGroupName'>,
    IAdtMetadataReadable<
      IFunctionGroupConfig,
      T['metadata'],
      'functionGroupName'
    >,
    IAdtUpdatable<
      Partial<IFunctionGroupConfig>,
      T['updated'],
      'functionGroupName',
      'source'
    >,
    IAdtMetadataUpdatable<
      Partial<IFunctionGroupConfig>,
      T['metadataUpdated'],
      'functionGroupName',
      'source'
    >,
    IAdtDeletable<
      IFunctionGroupConfig,
      T['deletion'],
      'functionGroupName',
      T['deletionCheck']
    >,
    IAdtValidatable<IFunctionGroupConfig, T['validation'], 'functionGroupName'>,
    IAdtCheckable<IFunctionGroupConfig, T['check'], 'functionGroupName'>,
    IAdtActivatable<IFunctionGroupConfig, T['activation'], 'functionGroupName'>,
    IAdtLockable<IFunctionGroupConfig, 'functionGroupName'>,
    IAdtTransportAware<
      IFunctionGroupConfig,
      T['transport'],
      'functionGroupName'
    >
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
  public readonly objectType: string = 'FunctionGroup';

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
      (functionGroupName, lockHandle) =>
        unlockFunctionGroup(this.connection, functionGroupName, lockHandle),
    );
  }

  /** Read the host's enhancement elements. */
  readEnhancementElements<E extends IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['enhancementElements'], E | IAdtError>>;
  readEnhancementElements(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['enhancementElements'], IAdtError>>;
  async readEnhancementElements<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['enhancementElements'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () =>
        getFunctionGroupEnhancementElements(
          connection,
          config.functionGroupName,
        ),
      this.results.enhancementElements,
      options?.analyse,
    );
  }

  /** Read the host's enhancement options. */
  readEnhancementOptions<E extends IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['enhancementOptions'], E | IAdtError>>;
  readEnhancementOptions(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['enhancementOptions'], IAdtError>>;
  async readEnhancementOptions<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['enhancementOptions'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () =>
        getFunctionGroupEnhancementOptions(
          connection,
          config.functionGroupName,
        ),
      this.results.enhancementOptions,
      options?.analyse,
    );
  }

  /** Validate a function group name before creating it. */
  validate<E extends IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        validateFunctionGroupName(
          connection,
          config.functionGroupName,
          config.packageName,
          config.description,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the function group. */
  create<E extends IAdtError>(
    config: Omit<IFunctionGroupConfig, 'source'> & {
      source?: never;
      packageName: string;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  create(
    config: Omit<IFunctionGroupConfig, 'source'> & {
      source?: never;
      packageName: string;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IFunctionGroupConfig, 'source'> & {
      source?: never;
      packageName: string;
      // Read by the request builder, so required (#304, D4).
      description: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E | IAdtError>> {
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

    const name = config.functionGroupName;
    return answering(
      () =>
        createFunctionGroup(
          connection,
          options.headers,
          {
            functionGroupName: name,
            packageName: config.packageName,
            transportRequest: config.transportRequest,
            description: config.description,
            masterSystem:
              config.masterSystem ?? this.systemContext.masterSystem,
            responsible: config.responsible ?? this.systemContext.responsible,
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

  /** Read the group's source — the function pool's main program. */
  read<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'read'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    version: AdtReadVersion | undefined,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  read(
    this: this & AdtPerformedBy<'functionGroup', 'read'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async read<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'read'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getFunctionGroupSource(
          connection,
          config.functionGroupName,
          version,
          options,
        ),
      this.results.source,
      options?.analyse,
    );
  }

  /**
   * Read the group's metadata: the group's own document, beside `read`,
   * which reads its source (the function pool's main program).
   */
  readMetadata<E extends IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () => getFunctionGroup(connection, config.functionGroupName, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /** The transport request the group belongs to. */
  readTransport<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'transport'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  readTransport(
    this: this & AdtPerformedBy<'functionGroup', 'transport'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'transport'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getFunctionGroupTransport(
          connection,
          config.functionGroupName,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport,
      options?.analyse,
    );
  }

  /**
   * Write the group's source — one PUT of `options.source` as the caller built
   * it, under the caller's `options.lockHandle` (and `config.transportRequest`
   * as `corrNr`), with the caller's headers. The caller holds the lock.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  update<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'update'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>>;
  update(
    this: this & AdtPerformedBy<'functionGroup', 'update'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], IAdtError>>;
  async update<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'update'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        uploadFunctionGroupSource(
          connection,
          options.headers,
          options.ifMatch,
          config.functionGroupName,
          options?.source,
          options?.lockHandle,
          config.transportRequest,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Write the group's metadata document — its description is what it holds.
   *
   * One request: the write, under the lock the caller holds
   * (`options.lockHandle`, required). The lock, the check and the unlock are
   * the caller's own calls of `lock`, `check` and `unlock`.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  updateMetadata<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'updateMetadata'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    this: this & AdtPerformedBy<'functionGroup', 'updateMetadata'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'updateMetadata'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.functionGroupName;

    return answering(
      () =>
        updateFunctionGroup(
          connection,
          options.headers,
          options.ifMatch,
          {
            function_group_name: name,
            lock_handle: options?.lockHandle,
            transport_request: config.transportRequest,
          },
          // The document the caller built, from the options — see
          // `AdtDomain.updateMetadata` for why that is the only channel.
          //
          // The description used to be merged
          // into a document read here, inside a lock window opened here; both
          // the read and the window are theirs now.
          options?.source,
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
  checkDeletion<E extends IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'deletionCheck'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>>;
  checkDeletion(
    this: this & AdtPerformedBy<'functionGroup', 'deletionCheck'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletionCheck'], IAdtError>>;
  async checkDeletion<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'deletionCheck'>,
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.functionGroupName;
    return answering(
      () =>
        checkDeletion(connection, options.headers, {
          function_group_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletionCheck,
      options?.analyse,
    );
  }

  /**
   * Delete the function group.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  delete<E extends IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.functionGroupName;
    return answering(
      () =>
        deleteFunctionGroup(connection, options.headers, {
          function_group_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion,
      options?.analyse,
    );
  }

  /** Activate the function group. Needs no stateful session. */
  activate<E extends IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>>;
  activate(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['activation'], IAdtError>>;
  async activate<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        activateFunctionGroup(
          connection,
          options.headers,
          config.functionGroupName,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Check the function group. */
  check<E extends IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['check'], E | IAdtError>>;
  check(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['check'], IAdtError>>;
  async check<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkFunctionGroup(
          connection,
          options.headers,
          config.functionGroupName,
          version,
        ),
      this.results.check,
      options?.analyse,
    );
  }

  /**
   * Lock the function group — one LOCK, its handle read by `lockHandleOf`. A
   * 200 carrying no handle reads as `''`; whether that is a refusal is the
   * caller's `analyse` to say.
   */
  lock<E extends IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const name = config.functionGroupName;
    return answering(
      async () => {
        const locked = await inStatefulSession(this.connection, () =>
          lockFunctionGroup(this.connection, name),
        );
        // The registry records SAP's state, not the caller's verdict: a lock
        // SAP granted (a 2xx carrying a handle) is recorded here, before any
        // `analyse` runs, so one it reports as a failure, or throws over, is
        // still released by `unlockAll`.
        const handle = lockHandleOf(locked);
        if (!failedWireStatus(locked) && handle) {
          this.lockTracker.track(name, handle);
        }
        return locked;
      },
      lockHandleOf,
      options?.analyse,
    );
  }

  /** Unlock the function group. */
  unlock<E extends IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: AdtObjectIdentity<IFunctionGroupConfig, 'functionGroupName'>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const name = config.functionGroupName;

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        const result = await inStatefulSession(this.connection, () =>
          unlockFunctionGroup(this.connection, name, lockHandle),
        );
        // The registry records SAP's state, not the caller's verdict: the lock
        // leaves it only when SAP answered the UNLOCK with a 2xx, before any
        // `analyse` runs; a refused or unanswered one may leave it held.
        if (!failedWireStatus(result)) this.lockTracker.untrack(name);
        return result;
      },
      nothing,
      options?.analyse,
    );
  }
}
