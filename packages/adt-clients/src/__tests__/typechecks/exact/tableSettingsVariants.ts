/**
 * The table settings' writes are typed by the client's variant, as
 * interfaces-adt 30.1.0 has them: on the cloud a write requires
 * `isWritableByAMDP` (a cloud PUT without it reset it to `false`, measured),
 * on premise it refuses it (nothing maps it there, Code); `AdtTableSettings`
 * of each variant is the contract's patchable and updatable of that variant.
 *
 * Compiled by `npm run test:check` under `tsconfig.test.exact.json`, against
 * the built declarations (`npm run build` first). Nothing here runs.
 */

import type { AdtTableSettings } from '@mcp-abap-adt/adt-clients/core';
import type {
  IAdtTableSettingsPatchable,
  IAdtTableSettingsUpdatable,
  ITableSettings,
} from '@mcp-abap-adt/interfaces-adt';

declare const cloud: AdtTableSettings<
  { metadata: string; metadataUpdated: string },
  'cloud'
>;
declare const onPremise: AdtTableSettings<
  { metadata: string; metadataUpdated: string },
  'onprem'
>;
declare const settings: ITableSettings;

export const cloudPatchable: IAdtTableSettingsPatchable<string, 'cloud'> =
  cloud;
export const onPremisePatchable: IAdtTableSettingsPatchable<string, 'onprem'> =
  onPremise;
export const cloudUpdatable: IAdtTableSettingsUpdatable<string, 'cloud'> =
  cloud;
export const onPremiseUpdatable: IAdtTableSettingsUpdatable<string, 'onprem'> =
  onPremise;

const headers = {
  accept: 'application/vnd.sap.adt.table.settings.v2+xml',
  contentType: 'application/vnd.sap.adt.table.settings.v2+xml; charset=utf-8',
};
export const cloudWithoutFlag = cloud.updateMetadata(
  // @ts-expect-error a cloud write without isWritableByAMDP would reset it
  { tableName: 'ZT', description: 'd', settings },
  { headers, lockHandle: 'H' },
);
export const onPremiseWithFlag = onPremise.updateMetadata(
  {
    tableName: 'ZT',
    description: 'd',
    // @ts-expect-error on premise nothing maps isWritableByAMDP
    settings: { ...settings, isWritableByAMDP: true },
  },
  { headers, lockHandle: 'H' },
);
export const onPremisePatchFlag = onPremise.patchMetadata(
  // @ts-expect-error on premise a patch names no isWritableByAMDP
  { tableName: 'ZT', changes: { isWritableByAMDP: true } },
  {
    headers: { accept: 'application/vnd.sap.adt.table.settings.v2+xml' },
    lockHandle: 'H',
  },
);
export const cloudPatchFlag = cloud.patchMetadata(
  { tableName: 'ZT', changes: { isWritableByAMDP: false } },
  {
    headers: { accept: 'application/vnd.sap.adt.table.settings.v2+xml' },
    lockHandle: 'H',
  },
);
