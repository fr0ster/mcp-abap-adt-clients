/**
 * What transport requests this user has, and what is in them.
 *
 * Read-only. `list()` runs the saved search Eclipse uses — the `?user=` and
 * `?status=` filters answer an empty `<tm:root/>` on every system measured, so
 * a configuration is the only way to get a list at all.
 *
 *   npx ts-node scripts/list-transports.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
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
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const answer = await new AdtClient(connection, logger).getRequest().list();
    if (!answer.ok) {
      // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
      console.log(`list failed: ${answer.getError().message}`);
      return;
    }
    const tree = answer.getResult().value;
    // biome-ignore lint/suspicious/noConsole: same
    console.log(`${tree.requests.length} request(s)\n`);
    for (const request of tree.requests) {
      const a = request.attributes;
      // biome-ignore lint/suspicious/noConsole: same
      console.log(
        `${a['tm:number']}  status=${a['tm:status']}  owner=${a['tm:owner']}  ` +
          `target=${a['tm:target'] || '—'}  desc=${a['tm:desc']}`,
      );
      // biome-ignore lint/suspicious/noConsole: same
      console.log(
        `    containers: ${request.containers.map((c) => c.element).join(' > ') || '—'}` +
          `  tasks: ${request.tasks.length}`,
      );
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
