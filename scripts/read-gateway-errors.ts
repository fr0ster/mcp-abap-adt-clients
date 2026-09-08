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
 *   GW_TRUNCATE=5000           — truncate output to N chars (0 or unset = no limit)
 *   MCP_ENV_PATH=trial.env     — switch SAP system
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtRuntimeClient } from '../src/clients/AdtRuntimeClient';
import { resultOf } from './resultOf';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const sessionConfigPath = path.resolve(
  __dirname,
  '../src/__tests__/helpers/sessionConfig',
);
const { getConfig } = require(sessionConfigPath);

const truncateLimit = process.env.GW_TRUNCATE
  ? Number.parseInt(process.env.GW_TRUNCATE, 10)
  : 0;

function printXml(xml: string) {
  if (truncateLimit > 0 && xml.length > truncateLimit) {
    console.log(xml.slice(0, truncateLimit));
    console.log('\n... (truncated)');
  } else {
    console.log(xml);
  }
}

async function main() {
  const config = getConfig();
  const errorType = process.argv[2];
  const errorId = process.argv[3];

  console.error(`Connecting to ${config.url}...`);
  const connection = await createTestConnection(createConnectionLogger());
  // Already open: `createTestConnection` connects before returning.
  try {
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

      console.error(
        `Gateway Error Log (user=${options.user || 'all'}, max=${options.maxResults})`,
      );
      const response = resultOf(await gw.list(options));
      const xml = response;
      printXml(xml);
      return;
    }

    if (!errorId) {
      console.error(
        'Usage: npx ts-node scripts/read-gateway-errors.ts "<errorType>" <errorId>',
      );
      process.exitCode = 1;
      return;
    }

    console.error(`Gateway Error: ${errorType} / ${errorId}`);
    const response = resultOf(await gw.getById(errorType, errorId));
    printXml(response);
  } finally {
    // In `finally`, and the session given back rather than left to time out.
    // A small pool is easy to exhaust — two concurrent sessions is the measured
    // ceiling on the trial — and a script that leaks one on every run locks the
    // next person out for no visible reason.
    await releaseTestConnection(connection);
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
