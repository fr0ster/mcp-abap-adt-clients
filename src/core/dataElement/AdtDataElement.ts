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
  IAdtDeletable,
  IAdtLockable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
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
  R extends IDataElementResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IDataElementResults,
> implements
    IAdtCreatable<IDataElementConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IDataElementConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IDataElementConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IDataElementConfig, ReturnType<R['deletion']>>,
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
  async validate(
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
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
      options?.analyse,
    );
  }

  /** Create the object. */
  async create(
    config: IDataElementConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
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

    return chain(this.logger, async ({ step, onScopeEnd, onFailure }) => {
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onFailure(async () => {
          if (!created) return;
          this.logger?.warn?.('Deleting data element after failure');
          await deleteDataElement(this.connection, {
            data_element_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      this.logger?.info?.('Creating data element');
      const value = await step(
        answering(
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
        ),
      );
      // Only past the step: a refused create leaves nothing to delete, and the
      // cleanup above must not remove an object this call did not make.
      created = true;
      this.logger?.info?.('Data element created');
      return value;
    });
  }

  /** Read the object.
   *
   * `version` is accepted and ignored: a data element is XML-based and has one
   * document, not an active/inactive source pair. */
  async read(
    config: Partial<IDataElementConfig>,
    _version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    // No 404 special case: ADT answers a read for a missing object with 200 and
    // an empty body, so absence was never a status to branch on — and whether
    // an empty body *is* absence is the caller's reading, through `analyse`.
    return answering(
      () => getDataElement(this.connection, name, options),
      this.results.source as IResultStrategy<ReturnType<R['source']>>,
      options?.analyse,
    );
  }

  /** Read the object's metadata document. */
  async readMetadata(
    config: Partial<IDataElementConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () => getDataElement(this.connection, name, options),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport(
    config: Partial<IDataElementConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['transport']>>> {
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
  async update(
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    const name = this.name(config);
    if (!config.packageName) {
      throw new Error('Package name is required for update');
    }
    if (!config.typeKind) {
      throw new Error('Type kind is required for update');
    }
    const source = options?.xmlContent;

    if (options?.lockHandle) {
      const lockHandle = options.lockHandle;
      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
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
            lockHandle,
            this.logger,
          ),
        this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
        options?.analyse,
      );
    }

    // A LOCK…UNLOCK window: a timeout in the middle releases the lock and
    // leaves the work half done, so the connection is told this is critical.
    const endCriticalSection = beginCriticalSection(this.connection);

    return chain(this.logger, async ({ step, onScopeEnd }) => {
      onScopeEnd(async () => {
        endCriticalSection();
      });

      this.logger?.info?.('Step 1: Locking data element');
      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: on older BASIS a lock handle is
      // only valid inside a stateful request, so going stateless before the
      // unlock would break the unlock (#106); and if the lock itself throws,
      // the session is still restored.
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      const lockHandle = await lockDataElement(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockDataElement(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });
      this.logger?.info?.('Data element locked, handle:', lockHandle);

      if (source) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await step(
          answering(
            () => checkDataElement(this.connection, name, 'inactive', source),
            this.results.check as IResultStrategy<ReturnType<R['check']>>,
            options?.analyse,
          ),
        );
      }

      // Always written: the fields come from the config, not from a
      // source string a caller may or may not have passed, so there is
      // nothing to skip and nothing to leave undefined.
      this.logger?.info?.('Step 3: Updating data element');
      const updated = await step(
        answering(
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
              lockHandle,
              this.logger,
            ),
          this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Data element updated');

      // The write produced the inactive version; the active one may not exist
      // yet. A failure here is not the update's failure, so it is logged and
      // the chain continues — the unlock still has to happen.
      const ready = await this.read(config, 'active', {
        withLongPolling: true,
      });
      if (!ready.ok) {
        this.logger?.warn?.(
          'read with long polling failed after update:',
          ready.getError().message,
        );
      }

      this.logger?.info?.('Step 4: Unlocking data element');
      this.connection.setSessionType('stateful');
      await unlockDataElement(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      // Unlocked as its own step, so the registration is discharged rather than
      // run a second time when the scope unwinds.
      releaseLock();
      this.logger?.info?.('Data element unlocked');

      this.logger?.info?.('Step 5: Final check');
      await step(
        answering(
          () => checkDataElement(this.connection, name, 'inactive'),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse,
        ),
      );

      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating data element');
        await step(
          answering(
            () => activateDataElement(this.connection, name),
            this.results.activation as IResultStrategy<
              ReturnType<R['activation']>
            >,
            options?.analyse ?? activationRefusal,
          ),
        );

        const ready = await this.read(config, 'active', {
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
   * Delete the object.
   *
   * The deletion check is read, not merely performed: ADT answers a refusal
   * with `del:isDeletable="false"` inside a 200, and a delete that ignored it
   * reported success while the object stayed. {@link deletionRefusal} is the
   * shipped reading of that answer; a caller who wants another passes their own
   * `analyse`.
   */
  async delete(
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      this.logger?.info?.('Checking data element for deletion');
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              data_element_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse ?? deletionRefusal,
        ),
      );
      this.logger?.info?.('Deletion check passed');

      // No stateful session: this delete uses no lock.
      this.logger?.info?.('Deleting data element');
      const value = await step(
        answering(
          () =>
            deleteDataElement(this.connection, {
              data_element_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
      this.logger?.info?.('Data element deleted');
      return value;
    });
  }

  /** Activate the object. Needs no stateful session. */
  async activate(
    config: Partial<IDataElementConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    const name = this.name(config);

    return answering(
      () => activateDataElement(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse ?? activationRefusal,
    );
  }

  /** Check the object. */
  async check(
    config: Partial<IDataElementConfig>,
    status?: string,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['check']>>> {
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
