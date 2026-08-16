import { createAbapConnection } from '@mcp-abap-adt/connection';
import * as dotenv from 'dotenv';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';

dotenv.config({ path: process.env.MCP_ENV_PATH!, quiet: true });
const q = { debug() {}, info() {}, warn() {}, error() {} } as any;
(async () => {
  const c = createAbapConnection(getConfig(), q);
  await c.connect();
  for (const [l, u] of [
    ['active  ', '/sap/bc/adt/ddic/ddl/sources/ZOK_I_PROBE/source/main'],
    [
      'inactive',
      '/sap/bc/adt/ddic/ddl/sources/ZOK_I_PROBE/source/main?version=inactive',
    ],
  ] as const) {
    const r = await c.makeAdtRequest({
      url: u,
      method: 'GET',
      timeout: 60000,
      headers: { Accept: 'text/plain' },
    });
    const s = String(r.data ?? '');
    process.stdout.write(
      `${l} ${r.status} ${s.length}b: ${s.slice(0, 200) || '(EMPTY)'}\n`,
    );
  }
})().catch((e) => process.stderr.write(String(e?.message ?? e) + '\n'));
