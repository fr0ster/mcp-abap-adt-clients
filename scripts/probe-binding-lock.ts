/**
 * Does a service binding lock, and does that release "You are already editing"?
 *
 * The binding's delete goes through `/sap/bc/adt/deletion/delete` with no lock
 * handle, and ADT refuses it with `You are already editing ZAC_SRVB01` — an
 * editing registration left by the create. `AdtServiceBinding` has no `lock`
 * and no `unlock`, so there is nothing to release it with, and a session
 * recycle does not clear it (measured: a brand new process, new session, same
 * refusal).
 *
 * Before proposing that the type gains `IAdtLockable`, find out whether the
 * endpoint even offers one.
 *
 *   npx ts-node scripts/probe-binding-lock.ts ZAC_SRVB01
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

async function main(): Promise<void> {
  const name = process.argv[2];
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const say = (line: string): void => {
    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log(line);
  };
  const uri = `/sap/bc/adt/businessservices/bindings/${encodeURIComponent(name.toLowerCase())}`;

  try {
    // A lock is a stateful conversation; without this the handle is refused.
    connection.setSessionType?.('stateful');

    say('POST …?_action=LOCK&accessMode=MODIFY');
    let lockHandle: string | undefined;
    try {
      const locked = await connection.makeAdtRequest({
        url: `${uri}?_action=LOCK&accessMode=MODIFY`,
        method: 'POST',
        timeout: 60000,
        headers: { Accept: 'application/vnd.sap.as+xml; charset=utf-8' },
      });
      const body = String(locked.data);
      lockHandle = /<LOCK_HANDLE>([^<]*)<\/LOCK_HANDLE>/.exec(body)?.[1];
      say(`  ${locked.status}, handle=${lockHandle ?? '(none)'}`);
      say(`  body: ${body.slice(0, 300)}`);
    } catch (error) {
      const e = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };
      say(`  threw ${e.response?.status}: ${e.message}`);
      say(`  body: ${String(e.response?.data ?? '').slice(0, 400)}`);
      return;
    }

    if (!lockHandle) return;

    say('POST …?_action=UNLOCK');
    try {
      const unlocked = await connection.makeAdtRequest({
        url: `${uri}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`,
        method: 'POST',
        timeout: 60000,
        headers: { Accept: 'application/vnd.sap.as+xml; charset=utf-8' },
      });
      say(`  ${unlocked.status}`);
    } catch (error) {
      const e = error as { response?: { status?: number }; message?: string };
      say(`  threw ${e.response?.status}: ${e.message}`);
    }
  } finally {
    connection.setSessionType?.('stateless');
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
