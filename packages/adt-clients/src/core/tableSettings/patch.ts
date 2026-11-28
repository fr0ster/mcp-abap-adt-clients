/**
 * The settings' patch: the settings a read answered, with the changes the
 * caller names — and nothing else. It sends no request (C7, 49.0.0).
 *
 * Read, patch, write — three calls, the caller's, under the settings' lock:
 *
 * ```ts
 * const read = await settings.readMetadata({ tableName }, { version: 'inactive' });
 * // read through adt-strategies' `tableSettings` (`cloudTableSettings` on the cloud)
 * const current = read.getResult().value;
 * if (!current.etag) return; // no ETag, no write: the PUT is guarded
 * const patched = patchTableSettings(current, { sizeCategory: '1' }, 'onprem');
 * if (patched.ok)
 *   await settings.updateMetadata(
 *     { tableName, description: patched.description, settings: patched.settings },
 *     { headers, lockHandle, ifMatch: current.etag },
 *   );
 * ```
 *
 * **The whole document, because SAP resets what a write leaves out**
 * (`CL_TABT_WB_PERSIST->move_adt_to_ddv`, Code on both systems; a field left
 * out read back reset, measured on both, 2026-11-19). The read must be made
 * under the lock, right before the PUT, and its ETag is the PUT's `If-Match`:
 * a read made earlier may already be stale, and a stale base resets what
 * another session changed in between.
 *
 * - Every setting not named keeps the value read — with one exception SAP
 *   makes, not the patch: when the resulting buffering type is not `G`, SAP
 *   clears the area-key count (it writes `SCHFELDANZ` only for `G`,
 *   `move_adt_to_ddv`, Code on both systems).
 * - `buffering` changes field by field; `translation` by its `value` alone,
 *   the one attribute SAP stores (`move_adt_to_ddv`, Code on both); the other
 *   three are written back as read.
 * - The cloud's `isWritableByAMDP` is written back as read unless named: a
 *   cloud write without it resets it to `false` (measured on the cloud). The
 *   read's type says whether it is there: `cloudTableSettings` throws on a
 *   cloud read without it.
 * - The area-key count read is sent when no count is named, whatever the
 *   resulting type; SAP keeps it only for `G`.
 * - **Refused:** an `areaKeyFields` change whose resulting type is not `G`
 *   (`area-key-fields-need-type-g`): SAP would drop it.
 *
 * The change set is typed (`ITableSettingsChangesOf<V>`): an empty one does
 * not compile, and on premise `isWritableByAMDP` does not either. A change
 * set built from outside the type system — a tool's JSON input — is checked
 * where it is built.
 */

import type {
  AdtModernVariant,
  ITableSettingsChanges,
  ITableSettingsChangesOf,
  ITableSettingsRead,
  ITableSettingsReadOf,
} from '@mcp-abap-adt/interfaces-adt';

/** What a read answers that the patch takes: the description and every setting. */
export interface ITableSettingsPatchRead<S> {
  readonly description: string;
  readonly settings: S;
}

/** Why a patch refuses. */
export type TableSettingsPatchRefusal = 'area-key-fields-need-type-g';

/** What a patch answers: the content of the write, or why it refuses. */
export type TableSettingsPatch<S> =
  | {
      readonly ok: true;
      readonly description: string;
      readonly settings: S;
    }
  | {
      readonly ok: false;
      readonly reason: TableSettingsPatchRefusal;
      readonly message: string;
    };

/**
 * The settings read on the cloud (`cloudTableSettings`: the flag is there),
 * with `changes` overlaid: `isWritableByAMDP` as read unless named.
 */
export function patchTableSettings(
  read: ITableSettingsPatchRead<ITableSettingsReadOf<'cloud'>>,
  changes: ITableSettingsChangesOf<'cloud'>,
  variant: 'cloud',
): TableSettingsPatch<ITableSettingsReadOf<'cloud'>>;
/**
 * The settings read on premise (`tableSettings`), with `changes` overlaid —
 * no `isWritableByAMDP` in the change (the type refuses it) or in the answer,
 * which is the on-premise write's settings as it is. An on-premise read never
 * carries the flag (Code: the transformation does not define it); one that
 * did would not reach the write.
 */
export function patchTableSettings(
  read: ITableSettingsPatchRead<ITableSettingsRead>,
  changes: ITableSettingsChangesOf<'onprem'>,
  variant: 'onprem',
): TableSettingsPatch<ITableSettingsReadOf<'onprem'>>;
export function patchTableSettings(
  read: ITableSettingsPatchRead<ITableSettingsRead>,
  changes: ITableSettingsChanges,
  variant: AdtModernVariant,
): TableSettingsPatch<ITableSettingsRead> {
  const settings = read.settings;
  const buffering = changes.buffering;
  const type = buffering?.type ?? settings.buffering.type;
  const areaKeyFields = buffering?.areaKeyFields;
  // SAP writes SCHFELDANZ only when the resulting type is G
  // (move_adt_to_ddv, Code on both): a count asked for another type would be
  // dropped on SAP's side, so it is refused here, before any PUT.
  if (areaKeyFields !== undefined && type !== 'G') {
    return {
      ok: false,
      reason: 'area-key-fields-need-type-g',
      message: `areaKeyFields ${areaKeyFields} is kept by SAP only with buffering type G; the resulting type is '${type}'`,
    };
  }
  // The declared variant decides the flag, never the read: on premise the
  // write carries none.
  const isWritableByAMDP =
    variant === 'cloud'
      ? (changes.isWritableByAMDP ?? settings.isWritableByAMDP)
      : undefined;
  return {
    ok: true,
    description: read.description,
    settings: {
      dataClassCategory:
        changes.dataClassCategory ?? settings.dataClassCategory,
      sizeCategory: changes.sizeCategory ?? settings.sizeCategory,
      buffering: {
        allowed: buffering?.allowed ?? settings.buffering.allowed,
        type,
        areaKeyFields: areaKeyFields ?? settings.buffering.areaKeyFields,
      },
      storageType: changes.storageType ?? settings.storageType,
      sharingType: changes.sharingType ?? settings.sharingType,
      loadUnit: changes.loadUnit ?? settings.loadUnit,
      translation: {
        ...settings.translation,
        value: changes.translation?.value ?? settings.translation.value,
      },
      loggingEnabled: changes.loggingEnabled ?? settings.loggingEnabled,
      ...(isWritableByAMDP === undefined ? {} : { isWritableByAMDP }),
    },
  };
}
