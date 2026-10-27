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
  for (const i of items)
    process.stdout.write(
      `type=${JSON.stringify(i.type)} name=${i.name} uri=${i.uri ?? '-'}\n`,
    );
})().catch((e) => process.stderr.write(String(e?.message ?? e) + '\n'));
