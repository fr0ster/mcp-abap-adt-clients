/**
 * Unpublish a service binding, through the members a consumer would use.
 *
 * Lock, unpublish, unlock — the flow from docs/usage/OBJECT_LIFECYCLE.md, and
 * the unlock is in a `finally` because a binding whose lock was never released
 * refuses its own delete afterwards.
 *
 * The job takes about two minutes of server time and the request may time out
 * before it finishes; the state read at the end is the verdict, not the call.
 *
 *   npx ts-node scripts/unpublish-binding.ts ZAC_SRVB01
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

// biome-ignore lint/suspicious/noConsole: a script reports to whoever ran it
const say = (line: string) => console.log(line);

async function main(): Promise<void> {
  const bindingName = process.argv[2];
  if (!bindingName) {
    say('usage: unpublish-binding.ts <BINDING_NAME>');
    return;
  }
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const bindings = new AdtClient(connection, logger).getServiceBinding();
  try {
    const locked = await bindings.lock({ bindingName });
    if (!locked.ok) {
      say(`lock refused: ${locked.getError().message}`);
      return;
    }
    const lockHandle = String(locked.getResult().value);
    say(`locked: ${lockHandle}`);
    try {
      const answer = await bindings.update({
        bindingName,
        desiredPublicationState: 'unpublished',
      });
      say(
        answer.ok
          ? 'unpublish answered a result'
          : `unpublish answered a failure: ${answer.getError().message.slice(0, 200)}`,
      );
    } finally {
      const unlocked = await bindings.unlock({ bindingName }, lockHandle);
      say(unlocked.ok ? 'unlocked' : `unlock: ${unlocked.getError().message}`);
    }

    const state = await bindings.read({ bindingName }, 'active');
    if (state.ok) {
      const document = String(state.getResult().value);
      const published = /srvb:published="([^"]*)"/.exec(document)?.[1];
      const allowed = /srvb:allowedAction="([^"]*)"/.exec(document)?.[1];
      say(`state now: published=${published} allowedAction=${allowed}`);
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a script reports to whoever ran it
  console.error(error);
  process.exit(1);
});
