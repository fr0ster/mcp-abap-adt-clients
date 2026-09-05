/**
 * What `/sap/bc/adt/deletion/check` answers for a package.
 *
 * The shared verdict parser read `(unnamed object)` and 0/0 references from it
 * and refused, which is its conservative default for a body it does not
 * recognise. Whether that body is a different shape or simply empty is a fact
 * about the server, so it gets measured rather than guessed.
 *
 *   npx ts-node scripts/probe-package-deletion.ts ZAC_INNER_PKG03
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { checkPackageDeletion } from '../src/core/package/delete';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

async function main(): Promise<void> {
  const name = process.argv[2];
  if (!name) {
    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log('usage: probe-package-deletion.ts <PACKAGE>');
    return;
  }
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const response = await checkPackageDeletion(connection, {
      package_name: name,
    });
    // biome-ignore lint/suspicious/noConsole: same
    console.log(`status: ${response.status}`);
    // biome-ignore lint/suspicious/noConsole: same
    console.log(`typeof data: ${typeof response.data}`);
    // biome-ignore lint/suspicious/noConsole: same
    console.log(String(response.data));
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
