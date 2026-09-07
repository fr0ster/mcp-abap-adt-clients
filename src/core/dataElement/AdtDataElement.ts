/**
 * AdtDataElement - CRUD for `DTEL/DE` data elements.
 *
 * A data element is an XML-based entity: it has no source, `read` and
 * `readMetadata` fetch the same document, and `update` is a read-modify-write
 * of that XML.
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
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
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
import type { IReadOptions } from '../shared/types';
import { activateDataElement } from './activation';
import { checkDataElement } from './check';
import { create as createDataElement } from './create';
import { checkDeletion, deleteDataElement } from './delete';
import { lockDataElement } from './lock';
import { getDataElement, getDataElementTransport } from './read';
import {
  dataElementDocuments,
  type IDataElementConfig,
  type IDataElementResults,
} from './types';
import { unlockDataElement } from './unlock';
import { updateDataElement } from './update';
import { validateDataElementName } from './validation';

export class AdtDataElement<
  R extends IDataElementResults = typeof dataElementDocuments,
> implements
    IAdtCreatable<IDataElementConfig, ReturnType<R['created']>>,
    IAdtMetadataReadable<IDataElementConfig, ReturnType<R['metadata']>>,
    IAdtMetadataUpdatable<
      Partial<IDataElementConfig>,
      ReturnType<R['metadataUpdated']>
    >,
    IAdtDeletable<
      IDataElementConfig,
      ReturnType<R['deletion']>,
      ReturnType<R['deletionCheck']>
    >,
    IAdtValidatable<IDataElementConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IDataElementConfig, ReturnType<R['check']>>,
    IAdtActivatable<IDataElementConfig, ReturnType<R['activation']>>,
    IAdtLockable<IDataElementConfig>,
    IAdtTransportAware<IDataElementConfig, ReturnType<R['transport']>>
{
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  protected readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'DataElement';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default: the shipped set
    // satisfies the erased bound, which the compiler cannot see through the
    // `unknown`s. A cast on a member would be the factory lying about what it
    // answers.
    protected readonly results: R = dataElementDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockDataElement(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake — nothing was asked of the server yet. */
  private name(config: Partial<IDataElementConfig>): string {
    if (!config.dataElementName) {
      throw new Error('Data element name is required');
    }
    return config.dataElementName;
  }

  /** Validate the name before creating the object. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['validation']>, E>> {
    const name = this.name(config);
    // The endpoint refuses an empty one, so this is a caller error rather than a
    // 400 to decode later.
    if (!config.description) {
      throw new Error('Description is required for validation');
    }

    return answering(
      () =>
        validateDataElementName(
          this.connection,
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
    config: Omit<IDataElementConfig, 'sourceCode'> & { sourceCode?: never },
    options?: IAdtCreateOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['created']>, E>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.typeKind) {
      throw new Error('Type kind is required');
    }
    return answering(
      () =>
        createDataElement(this.connection, {
          data_element_name: name,
          package_name: config.packageName as string,
          transport_request: config.transportRequest,
          description: config.description as string,
          type_kind: config.typeKind,
          type_name: config.typeName,
          data_type: config.dataType,
          length: config.length,
          decimals: config.decimals,
          short_label: config.shortLabel,
          medium_label: config.mediumLabel,
          long_label: config.longLabel,
          heading_label: config.headingLabel,
          search_help: config.searchHelp,
          search_help_parameter: config.searchHelpParameter,
          set_get_parameter: config.setGetParameter,
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
          masterLanguage:
            config.masterLanguage ?? this.systemContext.masterLanguage,
        }),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IDataElementConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>, E>> {
    const name = this.name(config);

    return answering(
      () => getDataElement(this.connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    config: Partial<IDataElementConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['transport']>, E>> {
    const name = this.name(config);

    return answering(
      () => getDataElementTransport(this.connection, name, options),
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
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['metadataUpdated']>, E>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }
    if (!config.typeKind) {
      throw new Error('Type kind is required for update');
    }

    return answering(
      () =>
        updateDataElement(
          this.connection,
          {
            data_element_name: name,
            package_name: config.packageName as string,
            transport_request: config.transportRequest,
            description: config.description,
            type_kind: config.typeKind,
            type_name: config.typeName,
            data_type: config.dataType,
            length: config.length,
            decimals: config.decimals,
            short_label: config.shortLabel,
            medium_label: config.mediumLabel,
            long_label: config.longLabel,
            heading_label: config.headingLabel,
            search_help: config.searchHelp,
            search_help_parameter: config.searchHelpParameter,
            set_get_parameter: config.setGetParameter,
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
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletionCheck']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        checkDeletion(this.connection, {
          data_element_name: name,
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
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>, E>> {
    const name = this.name(config);
    return answering(
      () =>
        deleteDataElement(this.connection, {
          data_element_name: name,
          transport_request: config.transportRequest,
        }),
      this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
      options?.analyse,
    );
  }

  /** Activate the object. Needs no stateful session. */
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['activation']>, E>> {
    const name = this.name(config);

    return answering(
      () => activateDataElement(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      (options?.analyse ?? activationRefusal) as IAnalyse<E>,
    );
  }

  /** Check the object. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IDataElementConfig>,
    status?: string,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<ReturnType<R['check']>, E>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkDataElement(this.connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the object for modification. */
  async lock(
    config: Partial<IDataElementConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockDataElement(this.connection, name);
        // Stateful for the LOCK request alone — see LockCapability.
        this.connection.setSessionType('stateless');
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
    config: Partial<IDataElementConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockDataElement(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      () => undefined,
    );
  }
}
