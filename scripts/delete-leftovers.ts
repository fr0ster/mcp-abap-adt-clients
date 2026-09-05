/**
 * Delete objects a failed run left behind.
 *
 * The flow tests create these and delete them again; a run that fails part-way
 * leaves one, and the next run's setup refuses to work against a system in that
 * state. That refusal is the behaviour we want — "nothing was verified" is a
 * better report than a green test that ran against someone else's object — so
 * the cleanup is a deliberate, named script rather than a force-delete hidden
 * inside the harness.
 *
 *   npx ts-node scripts/delete-leftovers.ts ZAC_INNER_PKG03 ZAC_SRVD01
 *
 * Names are matched against the list below, so a typo deletes nothing rather
 * than something else.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces';
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

/** What each name is, so the right handler deletes it. */
const KNOWN: Record<
  string,
  (client: AdtClient) => Promise<IAdtResponse<unknown>>
> = {
  ZAC_INNER_PKG03: (client) =>
    client.getPackage().delete({ packageName: 'ZAC_INNER_PKG03' }),
  ZAC_SRVD01: (client) =>
    client
      .getServiceDefinition()
      .delete({ serviceDefinitionName: 'ZAC_SRVD01' }),
  // Not a leftover: a shared fixture whose source drifted from the config.
  // `shared:setup` only creates what is missing, so a shared object that is
  // already there keeps whatever source it was first built with — delete it and
  // let setup rebuild it from the config as it stands now.
  ZAC_SHR_RUN01: (client) =>
    client.getClass().delete({ className: 'ZAC_SHR_RUN01' }),
  Z_AC_FM03: (client) =>
    client.getFunctionModule().delete({
      functionGroupName: 'ZAC_SHR_FUGR',
      functionModuleName: 'Z_AC_FM03',
    }),
};

async function main(): Promise<void> {
  const asked = process.argv.slice(2);
  if (asked.length === 0) {
    // biome-ignore lint/suspicious/noConsole: a script reports to whoever ran it
    console.log(`Names this script knows: ${Object.keys(KNOWN).join(', ')}`);
    return;
  }

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const client = new AdtClient(connection, logger);
    for (const name of asked) {
      const remove = KNOWN[name];
      if (!remove) {
        // biome-ignore lint/suspicious/noConsole: same
        console.log(`  ${name}: not a name this script knows — skipped`);
        continue;
      }
      const answer = await remove(client);
      if (answer.ok) {
        // biome-ignore lint/suspicious/noConsole: same
        console.log(`  ${name}: deleted`);
        continue;
      }
      const failure = answer.getError();
      // biome-ignore lint/suspicious/noConsole: same
      console.log(`  ${name}: [${failure.origin}] ${failure.message}`);
      // biome-ignore lint/suspicious/noConsole: same
      console.log(
        `    answered ${failure.response?.status} with ` +
          `${String(failure.response?.data ?? '').length} bytes: ` +
          String(failure.response?.data ?? '').slice(0, 300),
      );
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a script reports to whoever ran it
  console.error(error);
  process.exitCode = 1;
});
