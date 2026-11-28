/**
 * AdtTableSettings - a table's technical settings (`TABL/DTT`).
 *
 * Their own resource, `/sap/bc/adt/ddic/db/settings/{name}`, with their own
 * lock: `ENQUEUE_ESDICT` with `objtype` `TABT` (`CL_TABT_WB_PERSIST->lock`,
 * Code on both systems), held beside the table's lock in either order
 * (measured on both). SAP created default settings when it created the table,
 * and activating the table alone activated them (measured on both): this
 * handler has no create, delete or activation.
 *
 * Every member sends one request. The library retries nothing (the
 * connection may refresh its CSRF token and resend). A change of some settings
 * is the caller's three calls under the settings' lock — `readMetadata`, the
 * pure `patchTableSettings` (no request), `updateMetadata` with the read's
 * ETag as `ifMatch` — because SAP resets every setting a write leaves out
 * (`CL_TABT_WB_PERSIST->move_adt_to_ddv`, Code on both systems):
 *
 * ```typescript
 * // `headers`: the request's own pair — Accept
 * // `application/vnd.sap.adt.table.settings.v2+xml`, Content-Type the same
 * // (sent without a charset beside If-Match); `TABLE_SETTINGS` is the
 * // address, not the headers.
 * const settings = new AdtClientOnPrem(connection).getTableSettings({
 *   ...tableSettingsDocuments,
 *   metadata: tableSettings, // adt-strategies: every setting, the ETag
 * });
 * const locked = await settings.lock({ tableName });
 * if (!locked.ok) return locked;
 * const lockHandle = locked.getResult().value;
 * let written = false;
 * let released = false;
 * try {
 *   // Read under the lock, right before the PUT: an earlier read may be stale.
 *   const read = await settings.readMetadata({ tableName }, { version: 'inactive' });
 *   if (!read.ok) return read;
 *   const current = read.getResult().value;
 *   // No ETag, no write: the PUT is guarded with If-Match.
 *   if (!current.etag) return;
 *   const patched = patchTableSettings(current, { sizeCategory: '1' }, 'onprem');
 *   if (!patched.ok) return; // patched.reason, patched.message
 *   const put = await settings.updateMetadata(
 *     { tableName, description: patched.description, settings: patched.settings },
 *     { headers, lockHandle, ifMatch: current.etag },
 *   );
 *   written = put.ok;
 * } finally {
 *   released = (await settings.unlock({ tableName }, lockHandle)).ok;
 * }
 * if (written && released) {
 *   await client.getTable().activate({ tableName }, { headers: activationHeaders });
 * }
 * ```
 *
 * The result set given at construction makes the value of `readMetadata`
 * (`metadata`) and of the writes (`metadataUpdated`); `lock` answers the lock
 * handle, `unlock` nothing.
 */
import {
  AdtObjectErrorCodes,
  type AdtVariant,
  type IAdtAnalyseOptions,
  type IAdtError,
  type IAdtHeaders,
  type IAdtLockable,
  type IAdtMetadataReadable,
  type IAdtOperationOptions,
  type IAdtResponse,
  type IAdtTableSettingsUpdatable,
  type IAdtTableSettingsUpdateOptions,
  type IAnalyse,
  type ITableSettingsResults,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import type { AdtModernVariant } from '../../clients/variant';
import { answering, answeringExchange } from '../../utils/adtResponse';
import { withCallTimeout } from '../../utils/callTimeout';
import { lockHandleOf } from '../../utils/lockHandle';
import {
  nothing,
  type ResultStrategiesOf,
  type ResultValuesOf,
} from '../../utils/resultStrategy';
import { inStatefulSession } from '../shared/capabilities/statefulSession';
import type { AdtHandlerOptions } from '../shared/handlerOptions';
import {
  createLockTracker,
  failedWireStatus,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { lockTableSettings } from './lock';
import { getTableSettings } from './read';
import type {
  ITableSettingsConfig,
  ITableSettingsUpdateConfig,
  tableSettingsDocuments,
} from './types';
import { unlockTableSettings } from './unlock';
import { updateTableSettings } from './update';

/**
 * The settings' variant: one of the newer systems. SAP_BASIS 7.40 SP04's
 * discovery has no `/ddic/db/settings` collection, and the legacy client's
 * getter refuses every member without a request.
 */
type SettingsVariant<V extends AdtVariant> = Extract<V, AdtModernVariant>;

/** What each slot of the result set answers. */
export type TableSettingsValues = {
  readonly [K in keyof ITableSettingsResults]: unknown;
};

export class AdtTableSettings<
  T extends TableSettingsValues = ResultValuesOf<typeof tableSettingsDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtMetadataReadable<ITableSettingsConfig, T['metadata'], 'tableName'>,
    IAdtTableSettingsUpdatable<T['metadataUpdated'], SettingsVariant<V>>,
    IAdtLockable<ITableSettingsConfig, 'tableName'>
{
  /**
   * The release variant this serves, as a type only — never set. The
   * factories' and members' gates read it (see `clients/variant.ts`).
   */
  declare readonly variant?: V;
  protected readonly connection: IAbapConnection;
  protected readonly logger?: ILogger;
  private readonly lockTracker: LockTracker;
  public readonly objectType: string = 'TableSettings';

  protected readonly results: ResultStrategiesOf<T>;

  constructor(
    connection: IAbapConnection,
    options: AdtHandlerOptions<
      ResultStrategiesOf<T>,
      'logger' | 'lockRegistry'
    >,
  ) {
    const { logger, lockRegistry } = options;
    this.results = options.results;
    this.connection = connection;
    this.logger = logger;
    this.lockTracker = createLockTracker(
      lockRegistry,
      this.objectType,
      (name, lockHandle) =>
        unlockTableSettings(this.connection, name, lockHandle),
    );
  }

  /**
   * The name as the caller gave it. An identifying member takes the config
   * `Partial`, as the atoms do; a caller who passes no name builds a URL from
   * nothing, and the server answers.
   */
  private name(config: Partial<ITableSettingsConfig>): string {
    return config.tableName ?? '';
  }

  /** Read the settings document (v2). */
  readMetadata<E extends IAdtError>(
    config: Partial<ITableSettingsConfig>,
    options: IReadOptions & IAdtOperationOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>>;
  readMetadata(
    config: Partial<ITableSettingsConfig>,
    options?: IReadOptions & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadata'], IAdtError>>;
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<ITableSettingsConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E | IAdtError>> {
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options?.timeout);
    const name = this.name(config);
    return answering(
      () => getTableSettings(connection, name, options),
      this.results.metadata,
      options?.analyse,
    );
  }

  /**
   * Write every setting, under the caller's lock: one PUT of the document
   * built from `config` (with `ts:isWritableByAMDP` whenever the settings
   * carry it, `false` included), with `lockHandle` and,
   * when given, `transportRequest` as `corrNr`.
   *
   * **The whole content, every time.** This is a replace, never a merge: SAP
   * writes every DD09L field the transformation maps from the document
   * (`move_adt_to_ddv`, Code on both systems); read, change, write back.
   *
   * The variant rules on `isWritableByAMDP` are the type's
   * (`ITableSettingsUpdateConfig<V>`); at run time this checks only the
   * empty lock handle, and the document carries any boolean it is given.
   */
  updateMetadata<E extends IAdtError>(
    config: ITableSettingsUpdateConfig<SettingsVariant<V>>,
    options: { headers: IAdtHeaders } & IAdtTableSettingsUpdateOptions<E> & {
        analyse: IAnalyse<E>;
      },
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>>;
  updateMetadata(
    config: ITableSettingsUpdateConfig<SettingsVariant<V>>,
    options: {
      headers: IAdtHeaders;
    } & IAdtTableSettingsUpdateOptions<IAdtError>,
  ): Promise<IAdtResponse<T['metadataUpdated'], IAdtError>>;
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: ITableSettingsUpdateConfig<SettingsVariant<V>>,
    options: { headers: IAdtHeaders } & IAdtTableSettingsUpdateOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E | IAdtError>> {
    // **The one guard here, before any request.** The type requires a lock
    // handle; this refuses an empty one, which the type cannot rule out and
    // which the query would drop: the PUT would go out with no `lockHandle`.
    if (options.lockHandle === '') {
      throw new Error(
        'lockHandle is required for a settings write: an empty one would send the PUT without a lock',
      );
    }
    // The caller's deadline, if they set one, on every request below.
    const connection = withCallTimeout(this.connection, options.timeout);
    return answering(
      () =>
        updateTableSettings(
          connection,
          options.headers,
          options.ifMatch,
          config,
          options.lockHandle,
        ),
      this.results.metadataUpdated,
      options.analyse,
    );
  }

  /**
   * Lock the settings — one LOCK, its handle read by `lockHandleOf`.
   *
   * **A 2xx LOCK answered without a handle is a refusal** (`LOCK_FAILED`, the
   * answer kept as its `response`); a LOCK SAP refused keeps SAP's own
   * classification: the write needs the handle, and an empty
   * one would leave the PUT with no `lockHandle` at all. It is the starting
   * verdict, as every failure is: a caller's `analyse` sees it and may rule
   * otherwise. The registry follows the wire: a handle SAP answered with a
   * 2xx status is tracked whatever `analyse` rules, so `unlockAll()` can
   * release it.
   */
  lock<E extends IAdtError>(
    config: Partial<ITableSettingsConfig>,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<string, E | IAdtError>>;
  lock(
    config: Partial<ITableSettingsConfig>,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<string, IAdtError>>;
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<ITableSettingsConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E | IAdtError>> {
    const name = this.name(config);
    return answeringExchange(
      async () => {
        const locked = await inStatefulSession(this.connection, () =>
          lockTableSettings(this.connection, name),
        );
        // The registry follows the wire, before any `analyse` runs: a handle
        // SAP answered with a 2xx status is tracked whatever a caller rules,
        // so `unlockAll()` can release what the wire holds.
        const refused = failedWireStatus(locked);
        const held = refused ? '' : lockHandleOf(locked);
        if (held) this.lockTracker.track(name, held);
        // A LOCK SAP refused keeps SAP's classification (the default verdict
        // of a resolved refusal); only a 2xx answer without a handle is
        // `LOCK_FAILED`.
        return !refused && held === ''
          ? {
              answer: locked,
              failure: {
                origin: 'refusal',
                code: AdtObjectErrorCodes.LOCK_FAILED,
                message: `The LOCK of the technical settings of ${name} answered no lock handle`,
                response: locked,
              },
            }
          : { answer: locked };
      },
      lockHandleOf,
      options?.analyse,
    );
  }

  /**
   * Unlock the settings. The lock leaves the client's registry only when the
   * UNLOCK succeeded on the wire — SAP answered it with a 2xx status —
   * whatever a caller's `analyse` makes of the answer: a failed one stays
   * tracked, so `unlockAll()` can try again.
   */
  unlock<E extends IAdtError>(
    config: Partial<ITableSettingsConfig>,
    lockHandle: string,
    options: IAdtAnalyseOptions<E> & { analyse: IAnalyse<E> },
  ): Promise<IAdtResponse<void, E | IAdtError>>;
  unlock(
    config: Partial<ITableSettingsConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<IAdtError>,
  ): Promise<IAdtResponse<void, IAdtError>>;
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<ITableSettingsConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E | IAdtError>> {
    const name = this.name(config);
    // UNLOCK must run stateful (the context cookie goes with stateful
    // requests only); stateless after.
    return answering(
      async () => {
        const unlocked = await inStatefulSession(this.connection, () =>
          unlockTableSettings(this.connection, name, lockHandle),
        );
        // Released on the wire — SAP answered the UNLOCK with a 2xx status —
        // and untracked then, before any `analyse` runs. A connection that
        // resolves a 403 or a 500 released nothing.
        if (!failedWireStatus(unlocked)) this.lockTracker.untrack(name);
        return unlocked;
      },
      nothing,
      options?.analyse,
    );
  }
}
