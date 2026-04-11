/**
 * Read runtime dumps (ST22) from SAP system.
 *
 * Usage:
 *   npx ts-node scripts/read-dumps.ts                    # list dumps
 *   npx ts-node scripts/read-dumps.ts <dumpId>           # read specific dump
 *   npx ts-node scripts/read-dumps.ts <dumpId> summary   # read dump summary (HTML)
 *   npx ts-node scripts/read-dumps.ts <dumpId> formatted # read dump formatted (text)
 *
 * Options (env vars):
 *   DUMP_USER=CB9980000974     — filter by user
 *   DUMP_MAX=20                — max results
 *   MCP_ENV_PATH=trial.env     — switch SAP system
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { AdtRuntimeClient } from '../src/clients/AdtRuntimeClient';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const sessionConfigPath = path.resolve(
  __dirname,
  '../src/__tests__/helpers/sessionConfig',
);
const { getConfig } = require(sessionConfigPath);

async function main() {
  const config = getConfig();
  const dumpId = process.argv[2];
  const view = (process.argv[3] as 'summary' | 'formatted') || undefined;

  console.log(`Connecting to ${config.url}...`);
  const connection: IAbapConnection = createAbapConnection(config);
  await (connection as any).connect();

  const runtime = new AdtRuntimeClient(connection, undefined, {
    enableAcceptCorrection: true,
  });
  const dumps = runtime.getDumps();

  if (!dumpId) {
    const user = process.env.DUMP_USER || undefined;
    const top = process.env.DUMP_MAX
      ? Number.parseInt(process.env.DUMP_MAX, 10)
      : 20;

    console.log(
      `\n=== Runtime Dumps (user=${user || 'all'}, top=${top}) ===\n`,
    );

    const response = user
      ? await dumps.listByUser(user, { top, inlinecount: 'allpages' })
      : await dumps.list({ top, inlinecount: 'allpages' });

    const xml = String(response.data);
    // Extract dump IDs from Atom feed
    const idRegex = /\/sap\/bc\/adt\/runtime\/dumps?\/([^"'<\s]+)/g;
    const ids = new Set<string>();
    let match = idRegex.exec(xml);
    while (match) {
      ids.add(match[1]);
      match = idRegex.exec(xml);
    }

    console.log(`Found ${ids.size} dump(s):\n`);
    for (const id of ids) {
      console.log(`  ${id}`);
    }
    if (ids.size > 0) {
      console.log(
        `\nRead a specific dump: npx ts-node scripts/read-dumps.ts <dumpId>`,
      );
    }
    return;
  }

  console.log(`\n=== Dump: ${dumpId} (view=${view || 'default'}) ===\n`);
  const response = await dumps.getById(dumpId, view ? { view } : {});
  console.log(String(response.data).slice(0, 3000));
  if (String(response.data).length > 3000) {
    console.log('\n... (truncated)');
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
