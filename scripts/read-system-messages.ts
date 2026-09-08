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

async function main() {
  const config = getConfig();
  const messageId = process.argv[2];

  console.log(`Connecting to ${config.url}...`);
  const connection = await createTestConnection(createConnectionLogger());
  // Already open: `createTestConnection` connects before returning.
  try {
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
      const response = resultOf(await sm.list(options));
      const xml = response;
      console.log(xml.slice(0, 5000));
      if (xml.length > 5000) {
        console.log('\n... (truncated)');
      }
      return;
    }

    console.log(`\n=== System Message: ${messageId} ===\n`);
    const response = resultOf(await sm.getById(messageId));
    console.log(response.slice(0, 5000));
    if (response.length > 5000) {
      console.log('\n... (truncated)');
    }
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
