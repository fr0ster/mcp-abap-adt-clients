import type { AdtReadVersion } from '@mcp-abap-adt/interfaces-adt';
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
import { createLockTracker, type LockTracker } from '../shared/LockRegistry';
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
      T['enhancementOptions']
    >,
    IAdtCreatable<IFunctionGroupConfig, T['created']>,
    IAdtReadable<IFunctionGroupConfig, T['source']>,
    IAdtMetadataReadable<IFunctionGroupConfig, T['metadata']>,
    IAdtUpdatable<Partial<IFunctionGroupConfig>, T['updated']>,
    IAdtMetadataUpdatable<Partial<IFunctionGroupConfig>, T['metadataUpdated']>,
    IAdtDeletable<IFunctionGroupConfig, T['deletion'], T['deletionCheck']>,
    IAdtValidatable<IFunctionGroupConfig, T['validation']>,
    IAdtCheckable<IFunctionGroupConfig, T['check']>,
    IAdtActivatable<IFunctionGroupConfig, T['activation']>,
    IAdtLockable<IFunctionGroupConfig>,
    IAdtTransportAware<IFunctionGroupConfig, T['transport']>
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
  async readEnhancementElements<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['enhancementElements'], E>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () =>
        getFunctionGroupEnhancementElements(
          connection,
          config.functionGroupName as string,
        ),
      this.results.enhancementElements,
      options?.analyse,
    );
  }

  /** Read the host's enhancement options. */
  async readEnhancementOptions<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['enhancementOptions'], E>> {
    const connection = withCallTimeout(this.connection, options?.timeout);
    return answering(
      () =>
        getFunctionGroupEnhancementOptions(
          connection,
          config.functionGroupName as string,
        ),
      this.results.enhancementOptions,
      options?.analyse,
    );
  }

  /** Validate a function group name before creating it. */
  async validate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['validation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        validateFunctionGroupName(
          connection,
          config.functionGroupName as string,
          config.packageName,
          config.description,
        ),
      this.results.validation,
      options?.analyse,
    );
  }

  /** Create the function group. */
  async create<E extends IAdtError = IAdtError>(
    config: Omit<IFunctionGroupConfig, 'source'> & {
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

    const name = config.functionGroupName as string;
    return answering(
      () =>
        createFunctionGroup(
          connection,
          options.headers,
          {
            functionGroupName: name,
            packageName: config.packageName,
            transportRequest: config.transportRequest,
            description: config.description as string,
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
  async read<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'read'>,
    config: Partial<IFunctionGroupConfig>,
    version?: AdtReadVersion,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['source'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getFunctionGroupSource(
          connection,
          config.functionGroupName as string,
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
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getFunctionGroup(
          connection,
          config.functionGroupName as string,
          options,
        ),
      this.results.metadata,
      options?.analyse,
    );
  }

  /** The transport request the group belongs to. */
  async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'transport'>,
    config: Partial<IFunctionGroupConfig>,
    options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        getFunctionGroupTransport(
          connection,
          config.functionGroupName as string,
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
  async update<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'update'>,
    config: Partial<IFunctionGroupConfig>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['updated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        uploadFunctionGroupSource(
          connection,
          options.headers,
          options.ifMatch,
          config.functionGroupName as string,
          options?.source as string,
          options?.lockHandle as string,
          config.transportRequest,
        ),
      this.results.updated,
      options?.analyse,
    );
  }

  /**
   * Write the group's metadata document — its description is what it holds.
   *
   * With `options.lockHandle` the caller holds the lock and owns the chain, so
   * this is one request.
   *
   * **The whole content, every time.** This is a replace, never a merge. Read
   * what the object holds, change what you mean to change, and pass the result:
   * anything left out is gone, because nothing is read here to keep it.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'functionGroup', 'updateMetadata'>,
    config: Partial<IFunctionGroupConfig>,
    options: { headers: IAdtHeaders } & IAdtUpdateOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.functionGroupName as string;

    return answering(
      () =>
        updateFunctionGroup(
          connection,
          options.headers,
          options.ifMatch,
          {
            function_group_name: name,
            lock_handle: options?.lockHandle as string,
            transport_request: config.transportRequest,
          } as Parameters<typeof updateFunctionGroup>[3],
          // The document the caller built, from the options — see
          // `AdtDomain.updateMetadata` for why that is the only channel.
          //
          // The description used to be merged
          // into a document read here, inside a lock window opened here; both
          // the read and the window are theirs now.
          options?.source as string,
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
    this: this & AdtPerformedBy<'functionGroup', 'deletionCheck'>,
    config: Partial<IFunctionGroupConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletionCheck'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.functionGroupName as string;
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
  async delete<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['deletion'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const name = config.functionGroupName as string;
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
  async activate<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options: { headers: IAdtHeaders } & IAdtActivationOptions<E>,
  ): Promise<IAdtResponse<T['activation'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    return answering(
      () =>
        activateFunctionGroup(
          connection,
          options.headers,
          config.functionGroupName as string,
          options.preauditRequested ?? true,
        ),
      this.results.activation,
      options?.analyse,
    );
  }

  /** Check the function group. */
  async check<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    status: string | undefined,
    options: { headers: IAdtHeaders } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['check'], E>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);

    const version: 'active' | 'inactive' =
      status === 'active' ? 'active' : 'inactive';

    return answering(
      () =>
        checkFunctionGroup(
          connection,
          options.headers,
          config.functionGroupName as string,
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
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const name = config.functionGroupName as string;
    const answer = await answering(
      () =>
        inStatefulSession(this.connection, () =>
          lockFunctionGroup(this.connection, name),
        ),
      lockHandleOf,
      options?.analyse,
    );
    if (answer.ok && answer.getResult().value) {
      this.lockTracker.track(name, answer.getResult().value);
    }
    return answer;
  }

  /** Unlock the function group. */
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<IFunctionGroupConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
    const name = config.functionGroupName as string;

    return answering(
      async () => {
        // UNLOCK must run stateful (older BASIS #106); stateless after.
        const result = await inStatefulSession(this.connection, () =>
          unlockFunctionGroup(this.connection, name, lockHandle),
        );
        this.lockTracker.untrack(name);
        return result;
      },
      nothing,
      options?.analyse,
    );
  }
}
