/**
 * AdtTypeGroup — type groups (`TYPE/DG`).
 *
 * Every member sends one request and answers `IAdtResponse<T>`, where T is
 * what the result set given at construction makes of that endpoint's answer.
 * The name is sent as the caller gave it, never case-folded or checked: its
 * length (at most 5) and its validity are SAP's to refuse.
 *
 * On ABAP Cloud only validation, the reads and the versions are offered (the
 * cloud row of `ADT_TYPES_CLOUD`); every write is gated to the variants whose
 * row lists it.
 */
import type {
  AdtObjectIdentity,
  AdtReadVersion,
  AdtRequiredUpdateOptions,
  AdtVariant,
  IAdtActivatable,
  IAdtActivationOptions,
  IAdtAnalyseOptions,
  IAdtCreatable,
  IAdtCreateOptions,
  IAdtError,
  IAdtHeaders,
  IAdtLockable,
  IAdtLockedDeletable,
  IAdtLockedWrite,
  IAdtMetadataReadable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdatable,
  IAdtUpdateOptions,
  IAdtValidatable,
  IAdtVersionable,
  IAnalyse,
  ITypeGroupResults,
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
import { createLockTracker, type LockTracker } from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateTypeGroup } from './activation';
import { createTypeGroup } from './create';
import { deleteTypeGroup } from './delete';
import { lockTypeGroup } from './lock';
import { getTypeGroup, getTypeGroupSource } from './read';
import type { ITypeGroupConfig, typeGroupDocuments } from './types';
import { unlockTypeGroup } from './unlock';
import { updateTypeGroup } from './update';
import { validateTypeGroupName } from './validation';
import { getTypeGroupVersionSource, getTypeGroupVersions } from './versions';

/** What each slot of the result set answers. */
export type TypeGroupValues = {
  readonly [K in keyof ITypeGroupResults]: unknown;
};

type Identity = AdtObjectIdentity<ITypeGroupConfig, 'typeGroupName'>;

export class AdtTypeGroup<
  T extends TypeGroupValues = ResultValuesOf<typeof typeGroupDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtValidatable<ITypeGroupConfig, T['validation'], 'typeGroupName'>,
    IAdtCreatable<ITypeGroupConfig, T['created']>,
    IAdtMetadataReadable<ITypeGroupConfig, T['metadata'], 'typeGroupName'>,
    IAdtReadable<ITypeGroupConfig, T['source'], 'typeGroupName'>,
    IAdtUpdatable<
      Partial<ITypeGroupConfig>,
      T['updated'],
      'typeGroupName',
      'source'
    >,
    IAdtLockable<ITypeGroupConfig, 'typeGroupName'>,
    IAdtActivatable<ITypeGroupConfig, T['activation'], 'typeGroupName'>,
    IAdtVersionable<
      ITypeGroupConfig,
      T['versions'],
      T['versionSource'],
      'typeGroupName'
    >,
    IAdtLockedDeletable<ITypeGroupConfig, T['deletion'], 'typeGroupName'>
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'TypeGroup';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'systemContext' | 'lockRegistry'
    >,
  ) {
    const { logger, systemContext, lockRegistry } = options;
    this.results = options.results;
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) => unlockTypeGroup(this.connection, name, lockHandle),
    );
  }

  /** The name as the caller gave it: no case change, no check. */
  private name(config: Identity): string {
    return config.typeGroupName;
  }

  /** Validate the name: an empty `200` when valid, `400` when not. */
  validate<E extends IAdtError>(
    config: Identity,
    options: IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>>;
  validate(
    config: Identity,
    options?: IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['validation'], IAdtError>>;
  async validate<E extends IAdtError = IAdtError>(
    config: Identity,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    const name = this.name(config);
    return answering(
      () =>
        validateTypeGroupName(
          connection,
          name,
          config.packageName,
          config.description,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the type group: one `POST`; it is inactive until activated. */
  create<E extends IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'create'>,
    config: Omit<ITypeGroupConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['created'], E | IAdtError>>;
  create(
    this: this & AdtPerformedBy<'typeGroup', 'create'>,
    config: Omit<ITypeGroupConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['created'], IAdtError>>;
  async create<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'create'>,
    config: Omit<ITypeGroupConfig, 'source'> & {
      source?: never;
      packageName: string;
    },
    options: { headers: IAdtHeaders } & IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<T['created'], E | IAdtError>> {
    // The one guard this package keeps on a create (see AdtTransformation):
    // SAP creates nothing without a package.
    if (!config.packageName) {
      throw new Error(
        'packageName is required for create: SAP creates nothing without one',
      );
    }
    const connection = withCallTimeout(this.connection, options?.timeout);
    const name = this.name(config);
    return answering(
      () =>
        createTypeGroup(connection, options.headers, {
          type_group_name: name,
          package_name: config.packageName,
          description: config.description,
          transport_request: config.transportRequest,
          masterLanguage: createLanguage(
            config.masterLanguage,
            this.systemContext.masterLanguage,
          ),
        }),
      this.results.created,
      options?.analyse,
    );
  }

  /** Read the source (`source/main`). */
  read<E extends IAdtError>(
    config: Identity,
    version: AdtReadVersion | undefined,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['source'], E | IAdtError>>;
  read(
    config: Identity,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['source'], IAdtError>>;
  async read<E extends IAdtError = IAdtError>(
    config: Identity,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    const name = this.name(config);
    return answering(
      () => getTypeGroupSource(connection, name, version, options),
      this.results.source,
      options?.analyse,
    );
  }

  /**
   * Read the `atypgr:abapTypeGroup` document. Its `Accept` defaults to the
   * v3 media type: the read is refused without one.
   */
  readMetadata<E extends IAdtError>(
    config: Identity,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: Identity,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Identity,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    const name = this.name(config);
    return answering(
      () => getTypeGroup(connection, name, options?.version, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /**
   * Write the source: one `PUT` under the caller's lock
   * (`options.lockHandle`).
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  update<E extends IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'update'>,
    config: Identity,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>>;
  update(
    this: this & AdtPerformedBy<'typeGroup', 'update'>,
    config: Identity,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<IAdtError> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], IAdtError>>;
  async update<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'update'>,
    config: Identity,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E> &
      IAdtLockedWrite &
      AdtRequiredUpdateOptions<'source'>,
  ): Promise<IAdtResponse<T['updated'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    const name = this.name(config);
    return answering(
      () =>
        updateTypeGroup(
          connection,
          options.headers,
          options.ifMatch,
          {
            type_group_name: name,
            source_code: options.source,
            transport_request: config.transportRequest,
          },
          options.lockHandle,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Lock the type group — one LOCK, stateful for that request alone, its
   * handle read by `lockHandleOf` (`''` when SAP sent none).
   */
  lock<E extends IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'lock'>,
    config: Identity,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    this: this & AdtPerformedBy<'typeGroup', 'lock'>,
    config: Identity,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'lock'>,
    config: Identity,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const name = this.name(config);
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockTypeGroup(this.connection, name),
        ),
      lockHandleOf,
      options?.analyse,
    );
    if (answer.ok && answer.getResult().value) {
      this.lockTracker.track(name, answer.getResult().value);
    }
    return answer;
  }

  /** Unlock the type group — one UNLOCK, stateful for that request alone. */
  unlock<E extends IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'unlock'>,
    config: Identity,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    this: this & AdtPerformedBy<'typeGroup', 'unlock'>,
    config: Identity,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'unlock'>,
    config: Identity,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const name = this.name(config);
    return answering(
      async () => {
        // UNLOCK must run stateful, or it releases nothing; stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockTypeGroup(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      nothing,
      options?.analyse,
    );
  }

  /** Activate the type group: one request, its checklist as it came. */
  activate<E extends IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'activate'>,
    config: Identity,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>>;
  activate(
    this: this & AdtPerformedBy<'typeGroup', 'activate'>,
    config: Identity,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['activation'], IAdtError>>;
  async activate<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'activate'>,
    config: Identity,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    const name = this.name(config);
    return answering(
      () =>
        activateTypeGroup(
          connection,
          options.headers,
          name,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Version history of the source. */
  getVersions<E extends IAdtError>(
    config: Identity,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>>;
  getVersions(
    config: Identity,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versions'], IAdtError>>;
  async getVersions<E extends IAdtError = IAdtError>(
    config: Identity,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versions'], E | IAdtError>> {
    const name = this.name(config);
    return answering(
      () => getTypeGroupVersions(this.connection, name),
      this.results.versions,
      options?.analyse,
    );
  }

  /** Source of one version, by the `contentUri` its entry carried. */
  getVersionSource<E extends IAdtError>(
    contentUri: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['versionSource'], E | IAdtError>>;
  getVersionSource(
    contentUri: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<T['versionSource'], IAdtError>>;
  async getVersionSource<E extends IAdtError = IAdtError>(
    contentUri: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<T['versionSource'], E | IAdtError>> {
    return answering(
      () => getTypeGroupVersionSource(this.connection, contentUri),
      this.results.versionSource,
      options?.analyse,
    );
  }

  /**
   * Delete the type group: one `DELETE` on its own address under the
   * caller's lock (`options.lockHandle`). There is no deletion check.
   */
  delete<E extends IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'delete'>,
    config: Identity,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> &
      IAdtLockedWrite & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>>;
  delete(
    this: this & AdtPerformedBy<'typeGroup', 'delete'>,
    config: Identity,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<IAdtError> &
      IAdtLockedWrite,
  ): Promise<IAdtResponse<T['deletion'], IAdtError>>;
  async delete<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'typeGroup', 'delete'>,
    config: Identity,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E> &
      IAdtLockedWrite,
  ): Promise<IAdtResponse<T['deletion'], E | IAdtError>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    const name = this.name(config);
    return answering(
      () =>
        deleteTypeGroup(
          connection,
          options.headers,
          {
            type_group_name: name,
            transport_request: config.transportRequest,
          },
          options.lockHandle,
        ),
      this.results.deletion,
      options?.analyse,
    );
  }
}
