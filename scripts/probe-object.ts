/**
 * Does this object exist, and what does its source say?
 *
 * One GET. For confirming that a shared dependency a run needs is actually on
 * the system — a green `shared:setup` that printed nothing is not evidence.
 *
 *   npx ts-node scripts/probe-object.ts class ZAC_CLS023
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AdtSourceObjectType } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtClient } from '../src/clients/AdtClient';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

async function main(): Promise<void> {
  const [type, name] = process.argv.slice(2);
  if (!type || !name) {
    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log('usage: probe-object.ts <type> <NAME>');
    return;
  }
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const answer = await new AdtClient(connection, logger)
      .getUtils()
      .readObjectSource(type as AdtSourceObjectType, name);
    if (!answer.ok) {
      const failure = answer.getError();
      // biome-ignore lint/suspicious/noConsole: same
      console.log(`${name}: [${failure.origin}] ${failure.message}`);
      return;
    }
    const source = answer.getResult().value;
    // biome-ignore lint/suspicious/noConsole: same
    console.log(`${name}: ${source.length} bytes`);
    // biome-ignore lint/suspicious/noConsole: same
    console.log(source.slice(0, 400));
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
