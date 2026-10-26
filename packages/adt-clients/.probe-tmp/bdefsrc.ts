import { createAbapConnection } from '@mcp-abap-adt/connection';
import * as dotenv from 'dotenv';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';

dotenv.config({ path: process.env.MCP_ENV_PATH!, quiet: true });
const q = { debug() {}, info() {}, warn() {}, error() {} } as any;
(async () => {
  const c = createAbapConnection(getConfig(), q);
  await c.connect();
  const r = await c.makeAdtRequest({
    url: '/sap/bc/adt/bo/behaviordefinitions/ZOK_I_PROBE/source/main',
    method: 'GET',
    timeout: 60000,
    headers: { Accept: 'text/plain' },
  });
  process.stdout.write(
    `BDEF active (${String(r.data ?? '').length}b):\n${r.data}\n`,
  );
})().catch((e) => process.stderr.write(String(e?.message ?? e) + '\n'));
