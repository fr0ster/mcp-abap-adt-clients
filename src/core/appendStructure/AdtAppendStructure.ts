/**
 * AdtAppendStructure - CRUD for append structures (`TABL/DS`).
 *
 * `create` is metadata-only and needs `baseObject`; the fields come through
 * `update`, which writes DDL source.
 *
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
 */
import type {
  AdtNoFailure,
  IAbapConnection,
  IAdtActivatable,
  IAdtCheckable,
  IAdtCreatable,
  IAdtDeletable,
  IAdtError,
  IAdtLockable,
  IAdtOperationOptions,
  IAdtReadable,
  IAdtResponse,
  IAdtSystemContext,
  IAdtTransportAware,
  IAdtUpdatable,
  IAdtValidatable,
  IAdtVersionable,
  IAdtWireResponse,
  ILogger,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE, AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces';
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
import { activateAppendStructure } from './activation';
import { checkAppendStructure } from './check';
import { create as createAppendStructure } from './create';
import { checkDeletion, deleteAppendStructure } from './delete';
import { lockAppendStructure } from './lock';
import {
  getAppendStructure,
  getAppendStructureSource,
  getAppendStructureTransport,
} from './read';
import {
  appendStructureDocuments,
  type IAppendStructureConfig,
  type IAppendStructureResults,
} from './types';
import { unlockAppendStructure } from './unlock';
import { updateAppendStructure } from './update';
import { validateAppendStructureName } from './validation';
import {
  getAppendStructureVersionSource,
  getAppendStructureVersions,
} from './versions';

/** Statuses that mean the system has no validation resource, not that the name is bad. */
const VALIDATION_UNSUPPORTED_STATUSES = new Set([404, 405, 501]);

/**
 * The shipped reading of a validation answer this system may not offer.
 *
 * Measured: some systems answer 404, 405 or 501 for the append-structure
 * validation resource. That is not a verdict about the name, and reporting it
 * as one told a caller their name was rejected by a system that never looked
 * at it. It comes back as a failure named
 * {@link AdtObjectErrorCodes.UNSUPPORTED_OPERATION}, so a consumer branches on
 * the code rather than on a status they would have to dig out themselves.
 */
export const validationUnsupported = (
  verdict: IAdtError | AdtNoFailure,
  answer?: IAdtWireResponse,
): IAdtError | AdtNoFailure => {
  if (verdict === ADT_NO_FAILURE) return ADT_NO_FAILURE;
  const status = verdict.response?.status ?? answer?.status;
  return status && VALIDATION_UNSUPPORTED_STATUSES.has(status)
    ? {
        ...verdict,
        code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
        message: `This system does not offer append-structure name validation (HTTP ${status})`,
      }
    : verdict;
};

export class AdtAppendStructure<
  R extends IAppendStructureResults<
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown,
    unknown
  > = IAppendStructureResults,
> implements
    IAdtCreatable<IAppendStructureConfig, ReturnType<R['created']>>,
    IAdtReadable<
      IAppendStructureConfig,
      ReturnType<R['source']>,
      ReturnType<R['metadata']>
    >,
    IAdtUpdatable<IAppendStructureConfig, ReturnType<R['updated']>>,
    IAdtDeletable<IAppendStructureConfig, ReturnType<R['deletion']>>,
    IAdtValidatable<IAppendStructureConfig, ReturnType<R['validation']>>,
    IAdtCheckable<IAppendStructureConfig, ReturnType<R['check']>>,
    IAdtActivatable<IAppendStructureConfig, ReturnType<R['activation']>>,
    IAdtLockable<IAppendStructureConfig>,
    IAdtTransportAware<IAppendStructureConfig, ReturnType<R['transport']>>,
    IAdtVersionable<IAppendStructureConfig, ObjectVersion[], string>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'AppendStructure';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
    lockRegistry?: LockRegistry,
    // The one cast in this file, and it is on the default. See AdtClass.
    private readonly results: R = appendStructureDocuments as unknown as R,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockAppendStructure(this.connection, name, lockHandle),
    );
  }

  /** The name, or the caller's mistake. */
  private name(config: Partial<IAppendStructureConfig>): string {
    if (!config.appendStructureName) {
      throw new Error('Append structure name is required');
    }
    return config.appendStructureName;
  }

  /** Validate the name, where the system offers the resource. */
  async validate(
    config: Partial<IAppendStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['validation']>>> {
    const name = this.name(config);

    return answering(
      () =>
        validateAppendStructureName(this.connection, name, config.description),
      this.results.validation as IResultStrategy<ReturnType<R['validation']>>,
      options?.analyse ?? validationUnsupported,
    );
  }

  /** Create the append structure. Metadata only — the fields come via update. */
  async create(
    config: IAppendStructureConfig,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['created']>>> {
    const name = this.name(config);
    if (!config.baseObject) throw new Error('Base object is required');
    if (!config.packageName) throw new Error('Package name is required');
    if (!config.description) throw new Error('Description is required');

    return answering(
      () =>
        createAppendStructure(this.connection, {
          append_structure_name: name,
          base_object: config.baseObject as string,
          package_name: config.packageName as string,
          transport_request: config.transportRequest,
          description: config.description as string,
          masterSystem: this.systemContext.masterSystem,
          responsible: this.systemContext.responsible,
          masterLanguage:
            config.masterLanguage ?? this.systemContext.masterLanguage,
        }),
      this.results.created as IResultStrategy<ReturnType<R['created']>>,
      options?.analyse,
    );
  }

  /** Read the DDL source. */
  async read(
    config: Partial<IAppendStructureConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['source']>>> {
    const name = this.name(config);

    // No 404 special case: whether an empty answer *is* absence is the caller's
    // reading, supplied through `analyse`.
    return answering(
      () =>
        getAppendStructureSource(
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

  /** Read the metadata document. */
  async readMetadata(
    config: Partial<IAppendStructureConfig>,
    options?: IReadOptions & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['metadata']>>> {
    const name = this.name(config);

    return answering(
      () =>
        getAppendStructure(
          this.connection,
          name,
          options?.version ?? 'inactive',
          options,
          this.logger,
        ),
      this.results.metadata as IResultStrategy<ReturnType<R['metadata']>>,
      options?.analyse,
    );
  }

  /** The transport request the object belongs to. */
  async readTransport(
    config: Partial<IAppendStructureConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['transport']>>> {
    const name = this.name(config);

    return answering(
      () =>
        getAppendStructureTransport(
          this.connection,
          name,
          options?.withLongPolling !== undefined
            ? { withLongPolling: options.withLongPolling }
            : undefined,
        ),
      this.results.transport as IResultStrategy<ReturnType<R['transport']>>,
      options?.analyse,
    );
  }

  /**
   * Write the DDL source.
   *
   * **No check is run here on the caller's behalf.** Verifying the source about
   * to be written is the consumer's decision: only they know whether the object
   * is new or merely inactive, and only they can say what a finding should mean
   * for their flow. `check()` and `waitForCleanCheckRun()` are available for
   * that; this member does not insert an opinion between the caller and the
   * write.
   */
  async update(
    config: Partial<IAppendStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['updated']>>> {
    const name = this.name(config);
    const source = options?.sourceCode || config.sourceCode;

    if (options?.lockHandle) {
      if (!source) throw new Error('Source code is required for update');
      return answering(
        () =>
          updateAppendStructure(
            this.connection,
            {
              append_structure_name: name,
              source_code: source,
              transport_request: config.transportRequest,
            },
            options.lockHandle as string,
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

      this.connection.setSessionType('stateful');
      // Registered FIRST so it unwinds LAST: a handle is only valid inside a
      // stateful request on older BASIS (#106).
      onScopeEnd(async () => {
        this.connection.setSessionType('stateless');
      });

      let created = false;
      if (options?.deleteOnFailure) {
        onScopeEnd(async () => {
          if (!created) return;
          await deleteAppendStructure(this.connection, {
            append_structure_name: name,
            transport_request: config.transportRequest,
          });
        });
      }

      const lockHandle = await lockAppendStructure(this.connection, name);
      this.lockTracker.track(name, lockHandle);
      const releaseLock = onScopeEnd(async () => {
        await unlockAppendStructure(this.connection, name, lockHandle);
        this.lockTracker.untrack(name);
      });

      let updated = undefined as ReturnType<R['updated']>;
      if (source) {
        updated = await step(
          answering(
            () =>
              updateAppendStructure(
                this.connection,
                {
                  append_structure_name: name,
                  source_code: source,
                  transport_request: config.transportRequest,
                },
                lockHandle,
              ),
            this.results.updated as IResultStrategy<ReturnType<R['updated']>>,
            options?.analyse,
          ),
        );
        created = true;

        const ready = await this.read({ appendStructureName: name }, 'active', {
          withLongPolling: true,
        });
        if (!ready.ok) {
          this.logger?.warn?.(
            'read with long polling failed after update:',
            ready.getError().message,
          );
        }
      }

      this.connection.setSessionType('stateful');
      await unlockAppendStructure(this.connection, name, lockHandle);
      this.connection.setSessionType('stateless');
      this.lockTracker.untrack(name);
      releaseLock();

      if (options?.activateOnUpdate) {
        await step(this.activate({ appendStructureName: name }, options));

        const ready = await this.read({ appendStructureName: name }, 'active', {
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
   * Delete the append structure.
   *
   * The deletion check is read, not merely performed — see AdtProgram.delete.
   */
  async delete(
    config: Partial<IAppendStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['deletion']>>> {
    const name = this.name(config);

    return chain(this.logger, async ({ step }) => {
      await step(
        answering(
          () =>
            checkDeletion(this.connection, {
              append_structure_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.check as IResultStrategy<ReturnType<R['check']>>,
          options?.analyse ?? deletionRefusal,
        ),
      );

      return step(
        answering(
          () =>
            deleteAppendStructure(this.connection, {
              append_structure_name: name,
              transport_request: config.transportRequest,
            }),
          this.results.deletion as IResultStrategy<ReturnType<R['deletion']>>,
          options?.analyse,
        ),
      );
    });
  }

  /** Activate the append structure. */
  async activate(
    config: Partial<IAppendStructureConfig>,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['activation']>>> {
    const name = this.name(config);

    return answering(
      () => activateAppendStructure(this.connection, name),
      this.results.activation as IResultStrategy<ReturnType<R['activation']>>,
      options?.analyse,
    );
  }

  /** Check the append structure. */
  async check(
    config: Partial<IAppendStructureConfig>,
    status?: string,
    options?: IAdtOperationOptions,
  ): Promise<IAdtResponse<ReturnType<R['check']>>> {
    const name = this.name(config);
    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () => checkAppendStructure(this.connection, name, version),
      this.results.check as IResultStrategy<ReturnType<R['check']>>,
      options?.analyse,
    );
  }

  /** Lock the append structure for modification. */
  async lock(
    config: Partial<IAppendStructureConfig>,
  ): Promise<IAdtResponse<string>> {
    const name = this.name(config);

    return answering(
      async () => {
        this.connection.setSessionType('stateful');
        const lockHandle = await lockAppendStructure(this.connection, name);
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

  /** Unlock the append structure. */
  async unlock(
    config: Partial<IAppendStructureConfig>,
    lockHandle: string,
  ): Promise<IAdtResponse<void>> {
    const name = this.name(config);

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        this.connection.setSessionType('stateful');
        try {
          return await unlockAppendStructure(this.connection, name, lockHandle);
        } finally {
          this.connection.setSessionType('stateless');
          this.lockTracker.untrack(name);
        }
      },
      () => undefined,
    );
  }

  /** Version history of the object's source. */
  async getVersions(
    config: Partial<IAppendStructureConfig>,
  ): Promise<IAdtResponse<ObjectVersion[]>> {
    return answering(
      async () => ({
        data: await getAppendStructureVersions(this.connection, config),
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
        data: await getAppendStructureVersionSource(
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
