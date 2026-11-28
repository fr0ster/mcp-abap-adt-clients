/**
 * The API reference's type group example ("Type groups (`getTypeGroup()`)"),
 * as written there: compiled by `npm run test:check` under
 * `tsconfig.test.exact.json`, against the built declarations. Nothing here
 * runs. A change to the example is made here too.
 */

import { createAdtClient } from '@mcp-abap-adt/adt-clients';
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';

export async function typeGroupExample(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  writeHeaders: IAdtHeaders,
  activationHeaders: IAdtHeaders,
): Promise<void> {
  const client = await createAdtClient(connection, { variant: 'onprem' });
  const tg = client.getTypeGroup();
  await tg.create(
    { typeGroupName: 'ZTG1', packageName: '$TMP', description: 'Types' },
    { headers },
  );
  const locked = await tg.lock({ typeGroupName: 'ZTG1' });
  if (!locked.ok) throw new Error(locked.getError().message);
  const lockHandle = locked.getResult().value;
  await tg.update(
    { typeGroupName: 'ZTG1' },
    { headers: writeHeaders, lockHandle, source: 'TYPE-POOL ztg1 .' },
  );
  await tg.unlock({ typeGroupName: 'ZTG1' }, lockHandle);
  await tg.activate({ typeGroupName: 'ZTG1' }, { headers: activationHeaders });
}
