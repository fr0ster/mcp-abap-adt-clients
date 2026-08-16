import { createAbapConnection } from '@mcp-abap-adt/connection';
import * as dotenv from 'dotenv';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';
import { AdtUtils } from '../src/core/shared/AdtUtils';

dotenv.config({ path: process.env.MCP_ENV_PATH!, quiet: true });
const q = { debug() {}, info() {}, warn() {}, error() {} } as any;
(async () => {
  const c = createAbapConnection(getConfig(), q);
  await c.connect();
  const items = await new AdtUtils(c, q).getPackageContentsList(
    'ZBASE_PROBE01',
    { includeSubpackages: true },
  );
  process.stdout.write(`--- ZBASE_PROBE01 holds ${items.length}\n`);
  for (const i of items)
    process.stdout.write(`${i.type.padEnd(9)} ${i.name}\n`);
  // Is the source actually there, and is it active?
  for (const [label, url] of [
    ['TABL active ', '/sap/bc/adt/ddic/tables/ZOK_T_PROBE/source/main'],
    ['DDLS active ', '/sap/bc/adt/ddic/ddl/sources/ZOK_I_PROBE/source/main'],
    [
      'BDEF active ',
      '/sap/bc/adt/bo/behaviordefinitions/ZOK_I_PROBE/source/main',
    ],
    ['INTF active ', '/sap/bc/adt/oo/interfaces/ZOK_IF_PROBE/source/main'],
  ] as const) {
    try {
      const r = await c.makeAdtRequest({
        url,
        method: 'GET',
        timeout: 60000,
        headers: { Accept: 'text/plain' },
      });
      const s = String(r.data ?? '');
      process.stdout.write(
        `\n${label} ${r.status}, ${s.length} bytes${s ? ':\n' + s.slice(0, 220) : ' (EMPTY)'}\n`,
      );
    } catch (e: any) {
      process.stdout.write(
        `\n${label} -> ${e?.response?.status ?? e?.message}\n`,
      );
    }
  }
})().catch((e) => {
  process.stderr.write(String(e?.message ?? e) + '\n');
  process.exitCode = 1;
});
