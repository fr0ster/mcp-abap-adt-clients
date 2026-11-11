/**
 * Delete transport requests, by number.
 *
 * Deliberately by explicit number and never by a filter: a wildcard over
 * someone's transport requests is not a mistake you get to undo. ADT deletes
 * only an EMPTY request, so one holding objects comes back refused — which is
 * the server protecting the objects, not this script failing.
 *
 *   ../../node_modules/.bin/ts-node scripts/transport-admin.ts delete DEVK900001 DEVK900002
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import { headersOf } from '../src/__tests__/helpers/adtHeaders';
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
  const [action, ...rest] = process.argv.slice(2);
  if (action !== 'delete') {
    // biome-ignore lint/suspicious/noConsole: a script reports to whoever ran it
    console.log('usage: transport-admin.ts delete <NUMBER…>');
    return;
  }

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const requests = new AdtClient(connection, logger).getRequest();

    for (const transportNumber of rest) {
      const answer = await requests.delete(
        { transportNumber },
        { headers: headersOf(requests, 'delete') },
      );
      // biome-ignore lint/suspicious/noConsole: same
      console.log(
        answer.ok
          ? `  ${transportNumber}: deleted`
          : `  ${transportNumber}: [${answer.getError().origin}] ${answer.getError().message}`,
      );
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a script reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
