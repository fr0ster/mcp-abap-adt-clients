/**
 * One session, one lock, several writes.
 *
 * The earlier probe took a fresh lock for every round; this one takes it once
 * and writes under it repeatedly, which is what an editor does while somebody
 * keeps typing. Two things it can settle that the other could not:
 *
 *   - whether a lock handle stays good across many writes, or has to be renewed;
 *   - whether each activation adds its own `E_ABAP_GENPH`, or the object holds
 *     one that is simply refreshed. Same object, same session, same lock — so
 *     whatever SM12 shows afterwards came from the repetition and nothing else.
 *
 * The object is created if missing and **never deleted**. Nothing here cleans
 * up, on purpose: the residue is the measurement.
 *
 *   npx ts-node scripts/probe-repeated-update.ts
 *   npx ts-node scripts/probe-repeated-update.ts --writes 5
 *   npx ts-node scripts/probe-repeated-update.ts --writes 5 --no-activate
 *
 * `--no-activate` writes without activating, which separates the two suspects:
 * if the locks appear anyway, the write takes them; if they do not, activation
 * does.
 *
 * Times are stamped in the server's clock — UTC+3 on E19, `SERVER_UTC_OFFSET`
 * to change — because SM12 prints that one, and matching the two is the point.
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

const CLASS_NAME = process.env.PROBE_CLASS ?? 'ZAC_REPEAT_CLS';
const OFFSET = Number(process.env.SERVER_UTC_OFFSET ?? '3');

function note(line: string): void {
  const at = new Date(Date.now() + OFFSET * 3600_000)
    .toISOString()
    .slice(11, 19);
  process.stdout.write(`  ${at}  ${line}\n`);
}

function source(round: number): string {
  return `CLASS ${CLASS_NAME} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS note RETURNING VALUE(rv) TYPE string.
ENDCLASS.

CLASS ${CLASS_NAME} IMPLEMENTATION.
  METHOD note.
    rv = 'write ${round}'.
  ENDMETHOD.
ENDCLASS.`;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const writesAt = args.indexOf('--writes');
  const writes = writesAt >= 0 ? Number(args[writesAt + 1] ?? '3') : 3;
  const activating = !args.includes('--no-activate');
  const packageName = process.env.PROBE_PACKAGE ?? 'TEST_MCP';

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const cls = new AdtClient(connection, logger).getClass();
  const config = {
    className: CLASS_NAME,
    packageName,
    description: 'Repeated update under one lock',
  };

  note(
    `session opened — ${CLASS_NAME} in ${packageName}, ${writes} write(s), ${
      activating ? 'activating each time' : 'NOT activating'
    }`,
  );

  try {
    const created = await cls.create(config);
    note(
      `create    ${
        created.ok
          ? 'ok'
          : /exist/i.test(created.getError().message ?? '')
            ? 'already there — reused'
            : `REFUSED: ${created.getError().message}`
      }`,
    );

    // ONE lock for everything that follows.
    const lock = await cls.lock(config);
    if (!lock.ok) {
      note(`lock      REFUSED: ${lock.getError().message}`);
      return;
    }
    const handle = String(lock.getResult().value ?? '');
    note(`lock      ok (${handle.slice(0, 12)}…) — held for every write below`);

    for (let round = 1; round <= writes; round++) {
      const written = await cls.update(config, {
        sourceCode: source(round),
        lockHandle: handle,
      });
      note(
        `write ${String(round).padStart(2)}  ${
          written.ok ? 'ok' : `REFUSED: ${written.getError().message}`
        }`,
      );
      if (!written.ok) break;

      if (activating) {
        const activated = await cls.activate(config);
        note(
          `  activate  ${
            activated.ok ? 'ok' : `REFUSED: ${activated.getError().message}`
          }`,
        );
      }
    }

    await cls.unlock(config, handle);
    note('unlock    sent — one unlock for the whole window');
  } finally {
    await releaseTestConnection(connection);
    note('session released — the object is left in place');
  }
}

main().catch((error) => {
  process.stdout.write(`\nfailed: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
