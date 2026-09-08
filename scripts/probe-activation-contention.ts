/**
 * Does a standing `E_ABAP_GENPH` block the next activation?
 *
 * SM12 types that lock `X` — exclusive, non-cumulative: requested once, and
 * every later request is rejected *even from the same user*. Activation is what
 * takes it, and it is not released by `UNLOCK`; it goes when the session goes.
 * So a session that outlives its work leaves an exclusive lock on the generated
 * program, and by the type's own definition the next activation of that object
 * should be refused.
 *
 * This has been assumed both ways in this investigation and tested neither. The
 * earlier probe showed a leftover lock did NOT block a later `LOCK` — but that
 * was `SEOCLSENQ`, the editor lock, a different entry taken by a different call.
 * Nothing has ever asked whether a leftover `GENPH` blocks an *activation*.
 *
 * So: session A does the whole cycle and **stays open**, holding whatever the
 * activation took. Session B then makes the object inactive again and tries to
 * activate it. B's answer is the measurement.
 *
 *   npx ts-node scripts/probe-activation-contention.ts
 *
 * The object is left in place. Times are in the server's clock (UTC+3 on E19,
 * `SERVER_UTC_OFFSET` to change) so SM12 rows can be matched afterwards.
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

const CLASS_NAME = process.env.PROBE_CLASS ?? 'ZAC_ACTCONT_CLS';
const OFFSET = Number(process.env.SERVER_UTC_OFFSET ?? '3');

function note(line: string): void {
  const at = new Date(Date.now() + OFFSET * 3600_000)
    .toISOString()
    .slice(11, 19);
  process.stdout.write(`  ${at}  ${line}\n`);
}

function source(who: string): string {
  return `CLASS ${CLASS_NAME} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS note RETURNING VALUE(rv) TYPE string.
ENDCLASS.

CLASS ${CLASS_NAME} IMPLEMENTATION.
  METHOD note.
    rv = 'written by ${who}'.
  ENDMETHOD.
ENDCLASS.`;
}

/** lock → update → unlock → activate, reporting each answer. */
async function writeAndActivate(
  who: string,
  // biome-ignore lint/suspicious/noExplicitAny: probe, one handler
  cls: any,
  // biome-ignore lint/suspicious/noExplicitAny: one config, several calls
  config: any,
): Promise<void> {
  const lock = await cls.lock(config);
  if (!lock.ok) {
    note(`${who}  lock      REFUSED: ${lock.getError().message}`);
    return;
  }
  const handle = String(lock.getResult().value ?? '');
  note(`${who}  lock      ok (${handle.slice(0, 12)}…)`);

  const written = await cls.update(config, {
    sourceCode: source(who),
    lockHandle: handle,
  });
  note(
    `${who}  update    ${written.ok ? 'ok' : `REFUSED: ${written.getError().message}`}`,
  );

  await cls.unlock(config, handle);
  note(`${who}  unlock    sent`);

  const activated = await cls.activate(config);
  note(
    `${who}  activate  ${
      activated.ok ? 'ok' : `REFUSED: ${activated.getError().message}`
    }`,
  );
}

async function main(): Promise<void> {
  const logger = createConnectionLogger();
  const packageName = process.env.PROBE_PACKAGE ?? 'TEST_MCP';
  const config = {
    className: CLASS_NAME,
    packageName,
    description: 'Activation contention',
  };

  const a = await createTestConnection(logger);
  const b = await createTestConnection(logger);
  note(`two sessions open — ${CLASS_NAME} in ${packageName}`);

  try {
    const clsA = new AdtClient(a, logger).getClass();
    const clsB = new AdtClient(b, logger).getClass();

    const created = await clsA.create(config);
    note(
      `A     create    ${
        created.ok
          ? 'ok'
          : /exist/i.test(created.getError().message ?? '')
            ? 'already there — reused'
            : `REFUSED: ${created.getError().message}`
      }`,
    );

    note('--- session A writes and activates; its session then STAYS OPEN ---');
    await writeAndActivate('A   ', clsA, config);

    note('--- session B now tries the same object, with A still holding ---');
    await writeAndActivate('B   ', clsB, config);

    note(
      'if B activated, a standing GENPH does not block activation; ' +
        'if it was refused, it does',
    );
  } finally {
    await releaseTestConnection(a);
    await releaseTestConnection(b);
    note('both sessions released — object left in place');
  }
}

main().catch((error) => {
  process.stdout.write(`\nfailed: ${(error as Error).message}\n`);
  process.exitCode = 1;
});
