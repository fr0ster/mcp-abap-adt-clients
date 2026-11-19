/**
 * AdtTableSettings - a table's technical settings (`TABL/DTT`).
 *
 * Their own resource, `/sap/bc/adt/ddic/db/settings/{name}`, with their own
 * lock (ESDICT `TABT`, which the table's lock does not cover). SAP creates
 * them with the table, and activating the table activates them, so there is
 * no create, delete or activation here.
 *
 * Every member is one request, and the sequence is the caller's — the
 * library's lock pattern:
 *
 * ```typescript
 * // `headers`: the request's own pair — Accept
 * // `application/vnd.sap.adt.table.settings.v2+xml`, Content-Type the same
 * // with `; charset=utf-8`; `TABLE_SETTINGS` is the address, not the headers.
 * const settings = client.getTableSettings({
 *   ...tableSettingsDocuments,
 *   metadata: tableSettings, // adt-strategies: every setting, the ETag
 * });
 * const locked = await settings.lock({ tableName });
 * if (!locked.ok) return locked;
 * const lockHandle = locked.getResult().value;
 * let written = false;
 * let released = false;
 * try {
 *   const read = await settings.readMetadata({ tableName });
 *   if (!read.ok) return read;
 *   const current = read.getResult().value;
 *   // No ETag, no write: the PUT is guarded with If-Match.
 *   if (!current.etag) return;
 *   // …change what was read, keep the rest…
 *   const put = await settings.updateMetadata(
 *     { tableName, description: current.description, settings: changed },
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
 * Every member answers `IAdtResponse<T>`, where T is what the result set given
 * at construction makes of that endpoint's answer.
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
  type IAdtTableSettingsPatchable,
  type IAdtTableSettingsPatchHeaders,
  type IAdtTableSettingsPatchOptions,
  type IAdtTableSettingsUpdatable,
  type IAdtTableSettingsUpdateOptions,
  type ITableSettingsChangesOf,
  type ITableSettingsResults,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
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
  failedStatus,
  type LockTracker,
} from '../shared/LockRegistry';
import type { IReadOptions } from '../shared/types';
import { lockTableSettings } from './lock';
import { mergeSettings, namesASetting } from './merge';
import { getTableSettings } from './read';
import { readSettingsDocument } from './readDocument';
import type {
  ITableSettingsConfig,
  ITableSettingsUpdateConfig,
  tableSettingsDocuments,
} from './types';
import { unlockTableSettings } from './unlock';
import { updateTableSettings } from './update';

/**
 * The settings' variant: one of the newer systems (SAP_BASIS 7.40 serves no
 * settings; its client refuses the factory).
 */
type SettingsVariant<V extends AdtVariant> = Extract<V, AdtModernVariant>;

/**
 * The patch's changes per system kind, resolved: the contract's
 * `ITableSettingsChangesOf<W>` holds a conditional type, which, generic in a
 * class's `V`, makes TypeScript compare the clients structurally (and the
 * variant clients then fail to widen). Over this map of resolved types the
 * class stays covariant in `V`. `AdtTableSettings<T, W>` implements
 * `IAdtTableSettingsPatchable<…, W>` for each `W`
 * (`tableSettingsPatchable.typecheck`).
 */
interface ITableSettingsChangesByVariant {
  readonly onprem: ITableSettingsChangesOf<'onprem'>;
  readonly cloud: ITableSettingsChangesOf<'cloud'>;
}

/** What `patchMetadata` takes on variant `V`. */
export type TableSettingsPatchConfig<V extends AdtVariant> =
  ITableSettingsConfig & {
    changes: {
      [W in SettingsVariant<V>]: ITableSettingsChangesByVariant[W];
    }[SettingsVariant<V>];
  };

/** What each slot of the result set answers. */
export type TableSettingsValues = {
  readonly [K in keyof ITableSettingsResults]: unknown;
};

export class AdtTableSettings<
  T extends TableSettingsValues = ResultValuesOf<typeof tableSettingsDocuments>,
  V extends AdtVariant = AdtModernVariant,
> implements
    IAdtMetadataReadable<ITableSettingsConfig, T['metadata']>,
    IAdtTableSettingsUpdatable<T['metadataUpdated'], SettingsVariant<V>>,
    IAdtLockable<ITableSettingsConfig>
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
  async readMetadata<E extends IAdtError = IAdtError>(
    config: Partial<ITableSettingsConfig>,
    options?: IReadOptions & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['metadata'], E>> {
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
   * built from `config` (never `ts:isWritableByAMDP`), with `lockHandle` and,
   * when given, `transportRequest` as `corrNr`.
   *
   * **The whole content, every time.** This is a replace, never a merge: SAP
   * writes every setting from the document; read, change, write back.
   */
  async updateMetadata<E extends IAdtError = IAdtError>(
    config: ITableSettingsUpdateConfig<SettingsVariant<V>>,
    options: { headers: IAdtHeaders } & IAdtTableSettingsUpdateOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E>> {
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
   * Patch the settings under the caller's lock: read the working area
   * (`version: 'inactive'`) with its ETag, overlay `config.changes`, and write
   * the whole document guarded by `If-Match` (decision 51 of
   * interfaces-adt). SAP resets every setting a write leaves out
   * (`CL_TABT_WB_PERSIST->move_adt_to_ddv`, Code on both systems; measured on
   * both), so the whole document is written: the description read, every
   * setting not named as read, the cloud's `isWritableByAMDP` as read unless
   * named.
   *
   * The PUT's `Content-Type` is the media type without a charset: with
   * `; charset=utf-8` beside a fresh `If-Match` SAP answered `412`
   * `SADT_RESOURCE/043`, without it `200` (measured on both).
   *
   * Refused before any request (the caller's arguments): an empty lock handle,
   * a change set that names no setting. Refused before the PUT (what SAP's
   * read answered): a read with no ETag, a document this reading cannot read,
   * an `areaKeyFields` change whose resulting type is not `G` (SAP writes it
   * only for `G`, Code on both). A refused read or PUT is answered as SAP
   * answered it; nothing is retried.
   */
  async patchMetadata<E extends IAdtError = IAdtError>(
    config: TableSettingsPatchConfig<V>,
    options: {
      headers: IAdtTableSettingsPatchHeaders;
    } & IAdtTableSettingsPatchOptions<E>,
  ): Promise<IAdtResponse<T['metadataUpdated'], E>> {
    if (options.lockHandle === '') {
      throw new Error(
        'lockHandle is required for a settings patch: an empty one would send the PUT without a lock',
      );
    }
    if (!namesASetting(config.changes)) {
      throw new Error(
        'a settings patch names no setting: there is nothing to change',
      );
    }
    const connection = withCallTimeout(this.connection, options.timeout);
    const name = config.tableName;
    const mediaType = options.headers.accept;
    const refusal = (message: string, response: IAdtWireResponse) => ({
      answer: response,
      failure: {
        origin: 'refusal' as const,
        code: AdtObjectErrorCodes.UPDATE_FAILED,
        message: `The settings patch of ${name}: ${message}; nothing was written`,
        response,
      },
    });
    return answeringExchange(
      async () => {
        const read = await getTableSettings(connection, name, {
          version: 'inactive',
          accept: mediaType,
        });
        // A refusal SAP answered, which a connection resolved: the default
        // verdict reads it, as for every member.
        if (failedStatus(read)) return { answer: read };
        const etag = headerValue(read.headers, 'etag');
        if (etag === undefined) {
          return refusal('the read answered no ETag to guard the write', read);
        }
        const document = readSettingsDocument(
          typeof read.data === 'string' ? read.data : '',
        );
        if (!document) {
          return refusal(
            'the read answered a document without every setting the write needs',
            read,
          );
        }
        const merged = mergeSettings(document.settings, config.changes);
        if (!merged.ok) return refusal(merged.reason, read);
        const written = await updateTableSettings(
          connection,
          { accept: mediaType, contentType: mediaType },
          etag,
          {
            tableName: name,
            description: document.description,
            settings: merged.settings,
            transportRequest: config.transportRequest,
          },
          options.lockHandle,
        );
        return { answer: written };
      },
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
  async lock<E extends IAdtError = IAdtError>(
    config: Partial<ITableSettingsConfig>,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<string, E>> {
    const name = this.name(config);
    return answeringExchange(
      async () => {
        const locked = await inStatefulSession(this.connection, () =>
          lockTableSettings(this.connection, name),
        );
        // The registry follows the wire, before any `analyse` runs: a handle
        // SAP answered with a 2xx status is tracked whatever a caller rules,
        // so `unlockAll()` can release what the wire holds.
        const refused = failedStatus(locked);
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
  async unlock<E extends IAdtError = IAdtError>(
    config: Partial<ITableSettingsConfig>,
    lockHandle: string,
    options?: IAdtAnalyseOptions<E>,
  ): Promise<IAdtResponse<void, E>> {
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
        if (!failedStatus(unlocked)) this.lockTracker.untrack(name);
        return unlocked;
      },
      nothing,
      options?.analyse,
    );
  }
}

/** A header's value whatever the case of its name (`etag`, `ETag`). */
function headerValue(
  headers: Readonly<Record<string, unknown>> | undefined,
  name: string,
): string | undefined {
  for (const [key, value] of Object.entries(headers ?? {})) {
    if (
      key.toLowerCase() === name &&
      typeof value === 'string' &&
      value !== ''
    ) {
      return value;
    }
  }
  return undefined;
}
