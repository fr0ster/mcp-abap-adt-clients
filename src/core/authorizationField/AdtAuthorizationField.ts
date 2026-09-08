/**
 * AdtAuthorizationField - CRUD for `SUSO/O` authorization fields.
 *
 * An XML-based object: no source, so `read` and `readMetadata` fetch the same
 * document and `update` writes that XML.
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
  IAdtMetadataUpdatable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtUpdatable,
  IAdtValidatable,
  IAnalyse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { activationRefusal } from '../../utils/activationUtils';
import { answering } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { deletionRefusal } from '../../utils/deletionCheck';
import { validationRefusal } from '../../utils/validationRefusal';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import {
  createLockTracker,
  type LockRegistry,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { activateAuthorizationField } from './activation';
import { checkAuthorizationField } from './check';
import { create as createAuthorizationField } from './create';
import { checkDeletion, deleteAuthorizationField } from './delete';
import { lockAuthorizationField } from './lock';
import { readAuthorizationField } from './read';
import {
  authorizationFieldDocuments,
  type IAuthorizationFieldConfig,
  type IAuthorizationFieldResults,
} from './types';
import { unlockAuthorizationField } from './unlock';
import { updateAuthorizationField } from './update';
import { validateAuthorizationFieldName } from './validation';

export class AdtAuthorizationField<
  R extends IAuthorizationFieldResults = typeof authorizationFieldDocuments,
> implements
    IAdtCreatable<IAuthorizationFieldConfig, ReturnType<R['created']>>,
    IAdtMetadataReadable<IAuthorizationFieldConfig, ReturnType<R['metadata']>>,
    IAdtMetadataUpdatable<
      Partial<IAuthorizationFieldConfig>,
      ReturnType<R['metadataUpdated']>
    >,
    IAdtDeletable<
      IAuthorizationFieldConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IAuthorizationFieldConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IAuthorizationFieldConfig, ReturnType<R['check']>>,
    IAdtActivatable<IAuthorizationFieldConfig, ReturnType<R['activation']>>,
    IAdtLockable<IAuthorizationFieldConfig>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'AuthorizationField';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = authorizationFieldDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockAuthorizationField(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IAuthorizationFieldConfig>): string {
    if (!config.authorizationFieldName) {
      throw new Error('Authorization field name is required');
    }
    return config.authorizationFieldName;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    // The endpoint refuses an empty one, so this is a caller error rather than
    // a 400 to decode later.
    if (!config.description) {
      throw new Error('Description is required for validation');
    }

    return answering(
      () =>
        validateAuthorizationFieldName(
          connection,
          name,
          config.description as string,
          config.packageName,
        ),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      (options?.analyse ?? validationRefusal) as IAnalyse<E>,
    );
  }

  /** Create the object. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IAuthorizationFieldConfig, 'sourceCode'> & {
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
    return answering(
      () =>
        createAuthorizationField(connection, {
          authorization_field_name: name,
          description: config.description,
          package_name: config.packageName ?? '',
          transport_request: config.transportRequest,
          master_system: config.masterSystem ?? this.systemContext.masterSystem,
          responsible: config.responsible ?? this.systemContext.responsible,
          field_name: config.fieldName,
          roll_name: config.rollName,
          check_table: config.checkTable,
          exit_fb: config.exitFb,
          abap_language_version: config.abapLanguageVersion,
          search: config.search,
          objexit: config.objexit,
          domname: config.domname,
          outputlen: config.outputlen,
          convexit: config.convexit,
          orglvlinfo: config.orglvlinfo,
        }),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () =>
        readAuthorizationField(
          connection,
          name,
          options?.version ?? 'active',
          options,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
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
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadataUpdated']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }

    return answering(
      () =>
        updateAuthorizationField(
          connection,
          {
            authorization_field_name: name,
            description: config.description,
            package_name: config.packageName ?? '',
            transport_request: config.transportRequest,
            master_system:
              config.masterSystem ?? this.systemContext.masterSystem,
            responsible: config.responsible ?? this.systemContext.responsible,
            field_name: config.fieldName,
            roll_name: config.rollName,
            check_table: config.checkTable,
            exit_fb: config.exitFb,
            abap_language_version: config.abapLanguageVersion,
            search: config.search,
            objexit: config.objexit,
            domname: config.domname,
            outputlen: config.outputlen,
            convexit: config.convexit,
            orglvlinfo: config.orglvlinfo,
          },
          options?.lockHandle,
          this.logger,
        ),
      this.results.metadataUpdated as IResultStrategy<
        ReturnType<R['metadataUpdated']>
      >,
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
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(connection, {
          authorization_field_name: name,
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
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    return answering(
      () =>
        deleteAuthorizationField(connection, {
          authorization_field_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IAuthorizationFieldConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);

    return answering(
      () => activateAuthorizationField(connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IAuthorizationFieldConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkAuthorizationField(connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IAuthorizationFieldConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        const lockHandle = await inStatefulSession(this.connection, () =>
          lockAuthorizationField(this.connection, name),
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
    config: Partial<IAuthorizationFieldConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockAuthorizationField(
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
}
