/**
 * Two sessions, one object, one after the other.
 *
 * Each does the whole cycle a consumer does — lock, update, unlock, activate —
 * and the second starts only once the first has finished. The question is
 * whether anything the first session left behind gets in the second one's way:
 * an `E_ABAP_GENPH` on the generated program outlives the request that took it
 * and, measured on E19, outlives the run by about an hour. Whether it *blocks*
 * anything has been assumed rather than tested.
 *
 * Both sessions are opened here rather than reusing one, because that is the
 * whole point: `createTestConnection` opens a session of its own when no run
 * has published shared material, which is the case outside jest.
 *
 *   npx ts-node scripts/probe-two-sessions-one-object.ts
 *   npx ts-node scripts/probe-two-sessions-one-object.ts --contend
 *   npx ts-node scripts/probe-two-sessions-one-object.ts ZAC_TR_PKG E19K906816
 *
 * `--steps [seconds]` runs the cycle one step at a time, announcing each and
 * pausing, so SM12 can be watched between them. It exists because the lock this
 * is chasing — `E_ABAP_GENPH`, taken by the activation — is invisible from ADT:
 * there is no enqueue endpoint, and the contention probe below sees only the
 * editor lock. SM12 is the only channel, so the script's job is to make the
 * steps separable in time rather than to observe them itself.
 *
 * `--contend` asks the other question: not whether a released lock gets in the
 * way, but whether a held one does. The first session locks and keeps the
 * handle; the second tries to lock the same object while it is held. A refusal
 * there is the correct answer — it is what a lock is for — and a success would
 * mean the lock protects nothing.
 *
 * With no arguments it works in `TEST_MCP` with no transport, which is where
 * the suites work. The class is removed at the end unless `--keep` is given.
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

const CLASS_NAME = 'ZAC_TWOSESS_CLS';

function source(note: string): string {
  return `CLASS ${CLASS_NAME} DEFINITION PUBLIC FINAL CREATE PUBLIC.
  PUBLIC SECTION.
    METHODS note RETURNING VALUE(rv) TYPE string.
ENDCLASS.

CLASS ${CLASS_NAME} IMPLEMENTATION.
  METHOD note.
    rv = '${note}'.
  ENDMETHOD.
ENDCLASS.`;
}

/**
 * Every line stamped, in the server's own clock.
 *
 * The pauses this script used to rely on are useless when the output only
 * arrives once the run is over — nobody can watch SM12 in step with something
 * they cannot see yet. SM12 rows carry a time, so the answer is to stamp ours
 * and let the two be matched afterwards.
 *
 * The stamp is server-local, which on E19 is UTC+3, because that is the clock
 * SM12 prints. Comparing against the machine clock cost an hour of confusion
 * earlier in this investigation.
 */
const SERVER_UTC_OFFSET_HOURS = Number(process.env.SERVER_UTC_OFFSET ?? '3');

function stamp(): string {
  // `toISOString` prints UTC, so shifting the instant by the offset and reading
  // it as UTC gives the server's wall clock.
  const shifted = new Date(Date.now() + SERVER_UTC_OFFSET_HOURS * 3600_000);
  return shifted.toISOString().slice(11, 19);
}

function say(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** A step, with the server-clock time SM12 will show against it. */
function step(line: string): void {
  say(`  ${stamp()}  ${line}`);
}

/** The whole cycle on one connection, reporting every step by name. */
async function cycle(
  label: string,
  // biome-ignore lint/suspicious/noExplicitAny: probe, one flow over one handler
  cls: any,
  // biome-ignore lint/suspicious/noExplicitAny: one config, two handler calls
  config: any,
  note: string,
): Promise<boolean> {
  const step = async (
    name: string,
    run: () => Promise<{ ok: boolean; getError: () => { message?: string } }>,
  ): Promise<boolean> => {
    const answer = await run();
    say(
      `  ${label}  ${name.padEnd(9)} ${answer.ok ? 'ok' : `REFUSED: ${answer.getError().message}`}`,
    );
    return answer.ok;
  };

  const lock = await cls.lock(config);
  if (!lock.ok) {
    say(`  ${label}  lock      REFUSED: ${lock.getError().message}`);
    return false;
  }
  const handle = String(lock.getResult().value ?? '');
  say(`  ${label}  lock      ok (${handle.slice(0, 10)}…)`);

  const written = await step('update', () =>
    cls.update(config, { sourceCode: source(note), lockHandle: handle }),
  );
  await cls.unlock(config, handle);
  say(`  ${label}  unlock    sent`);
  const activated = await step('activate', () => cls.activate(config));
  return written && activated;
}

/** The first session keeps its lock; the second tries to take it anyway. */
async function contend(
  // biome-ignore lint/suspicious/noExplicitAny: probe, two handlers one config
  firstCls: any,
  // biome-ignore lint/suspicious/noExplicitAny: probe, two handlers one config
  secondCls: any,
  // biome-ignore lint/suspicious/noExplicitAny: one config, two handler calls
  config: any,
): Promise<void> {
  const held = await firstCls.lock(config);
  if (!held.ok) {
    say(`  first   lock      REFUSED: ${held.getError().message}`);
    return;
  }
  const handle = String(held.getResult().value ?? '');
  say(`  first   lock      ok (${handle.slice(0, 10)}…) and HELD`);

  const rival = await secondCls.lock(config);
  say(
    rival.ok
      ? `  second  lock      ok (${String(rival.getResult().value ?? '').slice(0, 10)}…) — the held lock did NOT block it`
      : `  second  lock      refused: ${rival.getError().message}`,
  );
  if (rival.ok) {
    await secondCls.unlock(config, String(rival.getResult().value ?? ''));
  }

  await firstCls.unlock(config, handle);
  say('  first   unlock    sent');
}

/** One step at a time, announced, with a pause for a human to look at SM12. */
async function stepwise(
  // biome-ignore lint/suspicious/noExplicitAny: probe, one handler
  cls: any,
  // biome-ignore lint/suspicious/noExplicitAny: one config, several calls
  config: any,
  pauseMs: number,
): Promise<void> {
  const pause = async (after: string): Promise<void> => {
    say(`
  ---- ${after} — look at SM12 now (${pauseMs / 1000}s) ----`);
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  };

  const created = await cls.create(config);
  say(
    `  create    ${created.ok ? 'ok' : /exist/i.test(created.getError().message ?? '') ? 'already there' : `REFUSED: ${created.getError().message}`}`,
  );
  await pause('after CREATE');

  const lock = await cls.lock(config);
  if (!lock.ok) {
    say(`  lock      REFUSED: ${lock.getError().message}`);
    return;
  }
  const handle = String(lock.getResult().value ?? '');
  say(`  lock      ok (${handle.slice(0, 10)}…)`);
  await pause('after LOCK — the editor lock should be visible');

  const written = await cls.update(config, {
    sourceCode: source('stepwise'),
    lockHandle: handle,
  });
  say(
    `  update    ${written.ok ? 'ok' : `REFUSED: ${written.getError().message}`}`,
  );
  await pause('after UPDATE');

  await cls.unlock(config, handle);
  say('  unlock    sent');
  await pause('after UNLOCK — the editor lock should be gone');

  const activated = await cls.activate(config);
  say(
    `  activate  ${activated.ok ? 'ok' : `REFUSED: ${activated.getError().message}`}`,
  );
  await pause('after ACTIVATE — this is the step that takes E_ABAP_GENPH');

  const deleted = await cls.delete(config);
  say(
    `  delete    ${deleted.ok ? 'ok' : `REFUSED: ${deleted.getError().message}`}`,
  );
  await pause('after DELETE — the object is gone; is the lock still there?');
}

/**
 * The same object, edited again and again, never deleted.
 *
 * Each round is one full cycle — lock, update, unlock, activate — on an object
 * that already exists and stays. Nothing is created after the first round and
 * nothing is removed, so whatever SM12 shows is the accumulation of the rounds
 * themselves rather than of objects coming and going.
 *
 * That is the question this answers: does each activation add its own
 * `E_ABAP_GENPH`, or does the object hold one that is simply renewed?
 */
async function repeatCycles(
  // biome-ignore lint/suspicious/noExplicitAny: probe, one handler
  cls: any,
  // biome-ignore lint/suspicious/noExplicitAny: one config, several calls
  config: any,
  rounds: number,
  pauseMs: number,
): Promise<void> {
  const created = await cls.create(config);
  say(
    `  create    ${created.ok ? 'ok' : /exist/i.test(created.getError().message ?? '') ? 'already there — reused' : `REFUSED: ${created.getError().message}`}`,
  );

  for (let round = 1; round <= rounds; round++) {
    say(`
  ---- round ${round} of ${rounds} ----`);

    const lock = await cls.lock(config);
    if (!lock.ok) {
      step(`lock      REFUSED: ${lock.getError().message}`);
      return;
    }
    const handle = String(lock.getResult().value ?? '');
    step(`lock      ok (${handle.slice(0, 10)}…)`);

    const written = await cls.update(config, {
      sourceCode: source(`round ${round}`),
      lockHandle: handle,
    });
    step(
      `update    ${written.ok ? 'ok' : `REFUSED: ${written.getError().message}`}`,
    );

    await cls.unlock(config, handle);
    step('unlock    sent');

    const activated = await cls.activate(config);
    step(
      `activate  ${activated.ok ? 'ok' : `REFUSED: ${activated.getError().message}`}`,
    );

    say(`  ---- round ${round} done — look at SM12 (${pauseMs / 1000}s) ----`);
    await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }

  say('\n  the object is LEFT IN PLACE — nothing was deleted');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const keep = args.includes('--keep');
  const contention = args.includes('--contend');
  const steps = args.includes('--steps');
  const rounds = args.includes('--repeat')
    ? Number(args[args.indexOf('--repeat') + 1] ?? '3')
    : 0;
  const pauseMs = Number(args.find((a) => /^\d+$/.test(a)) ?? '20') * 1000;
  const positional = args.filter(
    (a) => !a.startsWith('--') && !/^\d+$/.test(a),
  );
  const packageName = positional[0] ?? 'TEST_MCP';
  const transportRequest = positional[1];

  const logger = createConnectionLogger();
  // Inferred, not annotated: `create` takes the config without `sourceCode`
  // since interfaces 38, and a `Record<string, unknown>` no longer satisfies it.
  const config = {
    className: CLASS_NAME,
    packageName,
    description: 'Two sessions, one object',
    ...(transportRequest ? { transportRequest } : {}),
  };

  say(
    `\nobject ${CLASS_NAME} in ${packageName}${transportRequest ? ` on ${transportRequest}` : ' (local)'}\n`,
  );

  if (rounds > 0) {
    const only = await createTestConnection(logger);
    try {
      await repeatCycles(
        new AdtClient(only, logger).getClass(),
        config,
        rounds,
        pauseMs,
      );
    } finally {
      await releaseTestConnection(only);
      say('\n  session released — look at SM12 once more');
    }
    return;
  }

  if (steps) {
    const only = await createTestConnection(logger);
    try {
      await stepwise(new AdtClient(only, logger).getClass(), config, pauseMs);
    } finally {
      await releaseTestConnection(only);
      say('\n  session released — look at SM12 once more');
    }
    return;
  }

  // Both open up front in contention mode: the second must exist while the
  // first still holds its lock, which is the whole question there.
  if (contention) {
    const a = await createTestConnection(logger);
    const b = await createTestConnection(logger);
    try {
      const clsA = new AdtClient(a, logger).getClass();
      const created = await clsA.create(config);
      say(
        created.ok
          ? '  first   create    ok'
          : `  first   create    ${/exist/i.test(created.getError().message ?? '') ? 'already there' : `REFUSED: ${created.getError().message}`}`,
      );
      await contend(clsA, new AdtClient(b, logger).getClass(), config);
      if (!keep) {
        const deleted = await clsA.delete(config);
        say(
          deleted.ok
            ? `
${CLASS_NAME} deleted`
            : `
${CLASS_NAME} NOT deleted: ${deleted.getError().message}`,
        );
      }
    } finally {
      await releaseTestConnection(a);
      await releaseTestConnection(b);
    }
    return;
  }

  // ---- session one -------------------------------------------------------
  const first = await createTestConnection(logger);
  try {
    const cls = new AdtClient(first, logger).getClass();
    const created = await cls.create(config);
    say(
      created.ok
        ? '  first   create    ok'
        : `  first   create    ${/exist/i.test(created.getError().message ?? '') ? 'already there' : `REFUSED: ${created.getError().message}`}`,
    );
    await cycle('first ', cls, config, 'written by session one');
  } finally {
    await releaseTestConnection(first);
    say('  first   session released\n');
  }

  // ---- session two, on the same object ------------------------------------
  const second = await createTestConnection(logger);
  try {
    const cls = new AdtClient(second, logger).getClass();
    const ok = await cycle('second', cls, config, 'written by session two');
    say(
      ok
        ? '\nboth sessions completed the cycle — nothing the first left blocked the second'
        : '\nthe second session was refused — see the step above',
    );
    if (!keep) {
      const deleted = await cls.delete(config);
      say(
        deleted.ok
          ? `\n${CLASS_NAME} deleted`
          : `\n${CLASS_NAME} NOT deleted: ${deleted.getError().message}`,
      );
    } else {
      say(`\n${CLASS_NAME} left in place (--keep)`);
    }
  } finally {
    await releaseTestConnection(second);
  }
}

main().catch((error) => {
  say(`\nfailed: ${(error as Error).message}`);
  process.exitCode = 1;
});
