/**
 * The table settings' writes are typed by the client's variant, as
 * interfaces-adt 30.1.0 has them: on the cloud a write requires
 * `isWritableByAMDP` (a cloud PUT without it reset it to `false`, measured),
 * on premise it refuses it (nothing maps it there, Code); `AdtTableSettings`
 * of each variant is the contract's updatable of that variant. A change of
 * some settings is `patchTableSettings` (49.0.0): typed by the read and the
 * change set, its answer goes to the write of that variant.
 *
 * Compiled by `npm run test:check` under `tsconfig.test.exact.json`, against
 * the built declarations (`npm run build` first). Nothing here runs.
 */

import {
  AdtClientCloud,
  AdtClientOnPrem,
  type ResultValuesOf,
  tableSettingsDocuments,
} from '@mcp-abap-adt/adt-clients';
import {
  AdtTableSettings,
  patchTableSettings,
} from '@mcp-abap-adt/adt-clients/core';
import type {
  IAdtTableSettingsUpdatable,
  ITableSettings,
  ITableSettingsRead,
  ITableSettingsReadOf,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';

declare const cloud: AdtTableSettings<
  { metadata: string; metadataUpdated: string },
  'cloud'
>;
declare const onPremise: AdtTableSettings<
  { metadata: string; metadataUpdated: string },
  'onprem'
>;
declare const settings: ITableSettings;

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
declare const cloudRead: {
  description: string;
  settings: ITableSettingsReadOf<'cloud'>;
};
declare const onPremiseRead: {
  description: string;
  settings: ITableSettingsRead;
};
// The cloud patch's answer is the cloud write's settings, the flag among them.
const cloudPatched = patchTableSettings(
  cloudRead,
  { sizeCategory: '1' },
  'cloud',
);
export const cloudPatchWritten = cloudPatched.ok
  ? cloud.updateMetadata(
      {
        tableName: 'ZT',
        description: cloudPatched.description,
        settings: cloudPatched.settings,
      },
      { headers, lockHandle: 'H', ifMatch: 'E' },
    )
  : undefined;
export const cloudPatchFlag = patchTableSettings(
  cloudRead,
  { isWritableByAMDP: false },
  'cloud',
);
export const cloudFromGenericRead = patchTableSettings(
  // @ts-expect-error a cloud patch takes a cloud read: the flag must be there
  onPremiseRead,
  { sizeCategory: '1' },
  'cloud',
);
// @ts-expect-error a patch names at least one setting
export const emptyPatch = patchTableSettings(onPremiseRead, {}, 'onprem');
export const emptyBuffering = patchTableSettings(
  onPremiseRead,
  // @ts-expect-error a buffering change names at least one field
  { buffering: {} },
  'onprem',
);
export const onPremiseFlag = patchTableSettings(
  onPremiseRead,
  // @ts-expect-error on premise a change does not name isWritableByAMDP
  { isWritableByAMDP: true },
  'onprem',
);
// The on-premise answer is the on-premise write's settings, as it is.
const onPremisePatched = patchTableSettings(
  onPremiseRead,
  { sizeCategory: '1' },
  'onprem',
);
export const onPremisePatchWritten = onPremisePatched.ok
  ? onPremise.updateMetadata(
      {
        tableName: 'ZT',
        description: onPremisePatched.description,
        settings: onPremisePatched.settings,
      },
      { headers, lockHandle: 'H', ifMatch: 'E' },
    )
  : undefined;

// The declared system kind is tied to the handler's type (Codex round 2).
declare const connection: IAbapConnection;

// The cloud client's handler is inferred cloud-typed: a flagless write fails.
const inferredCloud = new AdtClientCloud(connection).getTableSettings();
export const inferredCloudFlagless = inferredCloud.updateMetadata(
  // @ts-expect-error a cloud write without isWritableByAMDP would reset it
  { tableName: 'ZT', description: 'd', settings },
  { headers, lockHandle: 'H' },
);
// The on-premise client's handler is on-premise-typed.
export const inferredOnPremise: AdtTableSettings<
  ResultValuesOf<typeof tableSettingsDocuments>,
  'onprem'
> = new AdtClientOnPrem(connection).getTableSettings();

// The handler takes no declaration of its own: the variant is its type
// (49.0.0; the constructor's variant option went with patchMetadata).
export const cloudHandler = new AdtTableSettings<
  ResultValuesOf<typeof tableSettingsDocuments>,
  'cloud'
>(connection, { results: tableSettingsDocuments });
export const cloudDeclaredRefused = new AdtTableSettings<
  ResultValuesOf<typeof tableSettingsDocuments>,
  'cloud'
>(connection, {
  results: tableSettingsDocuments,
  // @ts-expect-error the variant option is gone
  variant: 'cloud',
});
