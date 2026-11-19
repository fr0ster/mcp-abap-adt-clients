/**
 * A patch's overlay: the settings read, with the changes the caller named.
 *
 * - Every setting not named keeps the value read — with one exception SAP
 *   makes, not the patch: when the resulting buffering type is not `G`, SAP
 *   clears the area-key count (it writes `SCHFELDANZ` only for `G`,
 *   `move_adt_to_ddv`, Code on both systems).
 * - `translation` changes by its `value` alone, the one attribute SAP stores
 *   (`move_adt_to_ddv`, Code on both); the other three are written back as
 *   read.
 * - `isWritableByAMDP` (the cloud's) is written back as read unless named:
 *   a cloud write without it resets it to `false` (measured on the cloud).
 * - A field a caller set to `undefined` (possible without
 *   `exactOptionalPropertyTypes`) is not named: the value read is kept.
 */

import type {
  ITableSettingsChanges,
  ITableSettingsRead,
} from '@mcp-abap-adt/interfaces-adt';

/** What a merge answers: the settings to write, or why it refuses. */
export type SettingsMerge =
  | { readonly ok: true; readonly settings: ITableSettingsRead }
  | { readonly ok: false; readonly reason: string };

/** Whether `changes` names a setting at all (an explicit `undefined` names none). */
export function namesASetting(changes: ITableSettingsChanges): boolean {
  return Object.values(changes).some((value) => value !== undefined);
}

/** The read overlaid with the changes, or the refusal of a change SAP would drop. */
export function mergeSettings(
  read: ITableSettingsRead,
  changes: ITableSettingsChanges,
): SettingsMerge {
  const buffering = changes.buffering;
  const type = buffering?.type ?? read.buffering.type;
  const areaKeyFields = buffering?.areaKeyFields;
  // SAP writes SCHFELDANZ only when the resulting type is G
  // (move_adt_to_ddv, Code on both): a count asked for another type would be
  // dropped on SAP's side, so it is refused here, before any PUT.
  if (areaKeyFields !== undefined && type !== 'G') {
    return {
      ok: false,
      reason: `areaKeyFields ${areaKeyFields} is kept by SAP only with buffering type G; the resulting type is '${type}'`,
    };
  }
  const isWritableByAMDP = changes.isWritableByAMDP ?? read.isWritableByAMDP;
  return {
    ok: true,
    settings: {
      dataClassCategory: changes.dataClassCategory ?? read.dataClassCategory,
      sizeCategory: changes.sizeCategory ?? read.sizeCategory,
      buffering: {
        allowed: buffering?.allowed ?? read.buffering.allowed,
        type,
        areaKeyFields: areaKeyFields ?? read.buffering.areaKeyFields,
      },
      storageType: changes.storageType ?? read.storageType,
      sharingType: changes.sharingType ?? read.sharingType,
      loadUnit: changes.loadUnit ?? read.loadUnit,
      translation: {
        ...read.translation,
        value: changes.translation?.value ?? read.translation.value,
      },
      loggingEnabled: changes.loggingEnabled ?? read.loggingEnabled,
      ...(isWritableByAMDP === undefined ? {} : { isWritableByAMDP }),
    },
  };
}
