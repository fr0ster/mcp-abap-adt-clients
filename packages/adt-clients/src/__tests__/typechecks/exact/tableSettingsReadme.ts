/**
 * The README's settings example ("A table's technical settings"), compiled
 * against a cloud client: a read through `cloudTableSettings` written back as
 * a whole compiles, the cloud's `isWritableByAMDP` carried as a `boolean`.
 *
 * Compiled by `npm run test:check` under `tsconfig.test.exact.json`, against
 * the built declarations (`npm run build` first). Nothing here runs.
 */

import {
  AdtClientCloud,
  tableSettingsDocuments,
} from '@mcp-abap-adt/adt-clients';
import { cloudTableSettings } from '@mcp-abap-adt/adt-strategies';
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
