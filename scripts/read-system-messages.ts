/**
 * Read System Messages (SM02) from SAP system.
 *
 * Usage:
 *   npx ts-node scripts/read-system-messages.ts              # list messages
 *   npx ts-node scripts/read-system-messages.ts <messageId>  # read specific message
 *
 * Options (env vars):
 *   SM_USER=CB9980000974       — filter by user
 *   SM_MAX=10                  — max results
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
  const messageId = process.argv[2];

  console.log(`Connecting to ${config.url}...`);
  const connection: IAbapConnection = createAbapConnection(config);
  await (connection as any).connect();

  const runtime = new AdtRuntimeClient(connection, undefined, {
    enableAcceptCorrection: true,
  });
  const sm = runtime.getSystemMessages();

  if (!messageId) {
    const options = {
      user: process.env.SM_USER || undefined,
      maxResults: process.env.SM_MAX
        ? Number.parseInt(process.env.SM_MAX, 10)
        : 10,
    };

    console.log(
      `\n=== System Messages (user=${options.user || 'all'}, max=${options.maxResults}) ===\n`,
    );
    const response = await sm.list(options);
    const xml = String(response.data);
    console.log(xml.slice(0, 5000));
    if (xml.length > 5000) {
      console.log('\n... (truncated)');
    }
    return;
  }

  console.log(`\n=== System Message: ${messageId} ===\n`);
  const response = await sm.getById(messageId);
  console.log(String(response.data).slice(0, 5000));
  if (String(response.data).length > 5000) {
    console.log('\n... (truncated)');
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
