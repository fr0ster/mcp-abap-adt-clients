/**
 * The README's settings examples ("A table's technical settings"), compiled
 * against a cloud client and an on-premise one. On the cloud: a read through `cloudTableSettings` written back as
 * a whole compiles, the cloud's `isWritableByAMDP` carried as a `boolean`.
 *
 * Compiled by `npm run test:check` under `tsconfig.test.exact.json`, against
 * the built declarations (`npm run build` first). Nothing here runs.
 */

import {
  AdtClientCloud,
  AdtClientOnPrem,
  tableSettingsDocuments,
} from '@mcp-abap-adt/adt-clients';
import {
  cloudTableSettings,
  tableSettings,
} from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';

declare const connection: IAbapConnection;

const SETTINGS_HEADERS = {
  accept: 'application/vnd.sap.adt.table.settings.v2+xml',
  contentType: 'application/vnd.sap.adt.table.settings.v2+xml; charset=utf-8',
};

export async function example(lockHandle: string): Promise<boolean> {
  const client = new AdtClientCloud(connection);
  const settings = client.getTableSettings({
    ...tableSettingsDocuments,
    metadata: cloudTableSettings,
  });
  const target = { tableName: 'ZTABLE' };
  const read = await settings.readMetadata(target, { version: 'inactive' });
  if (!read.ok) return false;
  const current = read.getResult().value;
  if (!current.etag) return false;
  const put = await settings.updateMetadata(
    {
      ...target,
      description: current.description,
      settings: {
        ...current.settings,
        dataClassCategory: 'APPL1',
        sizeCategory: '1',
      },
    },
    { headers: SETTINGS_HEADERS, lockHandle, ifMatch: current.etag },
  );
  return put.ok;
}

/** The on-premise example: `tableSettings`, the cloud-only field left out. */
export async function onPremiseExample(lockHandle: string): Promise<boolean> {
  const onPremise = new AdtClientOnPrem(connection).getTableSettings({
    ...tableSettingsDocuments,
    metadata: tableSettings,
  });
  const target = { tableName: 'ZTABLE' };
  const read = await onPremise.readMetadata(target, { version: 'inactive' });
  if (!read.ok) return false;
  const current = read.getResult().value;
  if (!current.etag) return false;
  const { isWritableByAMDP: _cloudOnly, ...asRead } = current.settings;
  const put = await onPremise.updateMetadata(
    {
      ...target,
      description: current.description,
      settings: { ...asRead, dataClassCategory: 'APPL1', sizeCategory: '1' },
    },
    { headers: SETTINGS_HEADERS, lockHandle, ifMatch: current.etag },
  );
  return put.ok;
}
