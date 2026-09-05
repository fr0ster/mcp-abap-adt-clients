/**
 * What a package read actually answers, for a package that is there and one
 * that never was.
 *
 * `ensureObjectReady` decides on this answer, and both packages read back the
 * same 3836 bytes — which is either a coincidence or the endpoint answering
 * something generic. Measured rather than assumed.
 *
 *   npx ts-node scripts/probe-package.ts ZAC_INNER_PKG04 ZZ_NEVER_EXISTED_PKG
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
  const names = process.argv.slice(2);
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const packages = new AdtClient(connection, logger).getPackage();
    for (const name of names) {
      const answer = await packages.read({ packageName: name });
      if (!answer.ok) {
        // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
        console.log(`--- ${name}: FAILED ${answer.getError().message}`);
        continue;
      }
      const document = String(answer.getResult().value);
      // biome-ignore lint/suspicious/noConsole: same
      console.log(`--- ${name}: ${document.length} bytes`);
      // biome-ignore lint/suspicious/noConsole: same
      console.log(document.slice(0, 300).replace(/\n/g, ' '));
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
