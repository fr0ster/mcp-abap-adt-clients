/**
 * Read Gateway Error Log (/IWFND/ERROR_LOG) from SAP system.
 *
 * Usage:
 *   npx ts-node scripts/read-gateway-errors.ts                              # list errors
 *   npx ts-node scripts/read-gateway-errors.ts "Frontend Error" <errorId>   # read specific error
 *
 * Options (env vars):
 *   GW_USER=CB9980000974       — filter by user
 *   GW_MAX=10                  — max results
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
  const errorType = process.argv[2];
  const errorId = process.argv[3];

  console.log(`Connecting to ${config.url}...`);
  const connection: IAbapConnection = createAbapConnection(config);
  await (connection as any).connect();

  const runtime = new AdtRuntimeClient(connection, undefined, {
    enableAcceptCorrection: true,
  });
  const gw = runtime.getGatewayErrorLog();

  if (!errorType) {
    const options = {
      user: process.env.GW_USER || undefined,
      maxResults: process.env.GW_MAX
        ? Number.parseInt(process.env.GW_MAX, 10)
        : 10,
    };

    console.log(
      `\n=== Gateway Error Log (user=${options.user || 'all'}, max=${options.maxResults}) ===\n`,
    );
    const response = await gw.list(options);
    const xml = String(response.data);
    console.log(xml.slice(0, 5000));
    if (xml.length > 5000) {
      console.log('\n... (truncated)');
    }
    return;
  }

  if (!errorId) {
    console.error(
      'Usage: npx ts-node scripts/read-gateway-errors.ts "<errorType>" <errorId>',
    );
    process.exit(1);
  }

  console.log(`\n=== Gateway Error: ${errorType} / ${errorId} ===\n`);
  const response = await gw.getById(errorType, errorId);
  console.log(String(response.data).slice(0, 5000));
  if (String(response.data).length > 5000) {
    console.log('\n... (truncated)');
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
