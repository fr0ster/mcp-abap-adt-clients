/**
 * Two consecutive writes to one class, each with its own lock → update →
 * unlock → activate.
 *
 * **Why a second cycle, and not just one.** Since the "one endpoint, one
 * member" change the lock window is the caller's sequence, not something
 * `update` composes behind their back. That makes the first cycle prove very
 * little on its own: a `lock` that answers a handle, a PUT that answers 200 and
 * an `unlock` that answers 200 all look identical whether or not the enqueue
 * was actually released. The second `lock` on the same object is the only thing
 * that can tell the difference — if the first window leaked, ADT refuses here,
 * and it refuses with the name of whoever still holds it.
 *
 * It is also where a replaced session shows: the two-layer model says an HTTP
 * session can be exchanged underneath a live ABAP session, and the symptom is
 * not an error on the request that caused it but a lock handle that has stopped
 * meaning anything by the time the next window opens.
 *
 * **The lock handle is not the evidence.** Measured here on a cloud trial: two
 * cycles inside one process get the *same* handle, and a second process against
 * the same class gets a different one (9A97E458… then D1AFDC1F…). So the handle
 * is the session's, not the window's, and comparing the two tells you nothing
 * about whether the first window closed. What does tell you is the last step: an
 * update attempted with no handle at all, after the last unlock. If ADT refuses
 * it, the enqueue is genuinely gone.
 *
 * So this reports, per step: the outcome and how long it took. Then it reads the
 * active source back, because "the PUT answered 200" and "the second revision is
 * what the system now has" are different claims and only the second one matters.
 *
 *   MCP_ENV_PATH=~/.config/mcp-abap-adt/sessions/trial.env \
 *     npx ts-node scripts/probe-two-update-cycles.ts [ZAC_CLS_NAME]
 *
 * The class is created if it is not there, and left behind either way — a
 * probe you can run twice is worth more than one that cleans up.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAdtResponse } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

function say(line: string): void {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.log(line);
}

/** What one step of a cycle produced. */
interface IStep {
  name: string;
  ok: boolean;
  ms: number;
  detail: string;
}

/**
 * Run one member and describe what came back, without stopping the probe.
 *
 * A failure mid-cycle is the interesting case, not a reason to exit: the whole
 * point is to reach the *second* lock and see what it says.
 */
async function step<T>(
  name: string,
  run: () => Promise<IAdtResponse<T>>,
  describe: (value: T) => string = () => 'ok',
): Promise<{ record: IStep; value?: T }> {
  const started = Date.now();
  try {
    const answer = await run();
    const ms = Date.now() - started;
    if (!answer.ok) {
      const failure = answer.getError();
      return {
        record: {
          name,
          ok: false,
          ms,
          detail: `[${failure.origin}] ${failure.message.replace(/\s+/g, ' ').slice(0, 160)}`,
        },
      };
    }
    const value = answer.getResult().value;
    return { record: { name, ok: true, ms, detail: describe(value) }, value };
  } catch (error) {
    return {
      record: {
        name,
        ok: false,
        ms: Date.now() - started,
        detail: `threw: ${String((error as Error).message ?? error).slice(0, 160)}`,
      },
    };
  }
}

/** The class body, differing only in the constant, so a read-back is decisive. */
function sourceFor(className: string, revision: number): string {
  const lower = className.toLowerCase();
  return [
    `CLASS ${lower} DEFINITION`,
    '  PUBLIC',
    '  FINAL',
    '  CREATE PUBLIC.',
    '  PUBLIC SECTION.',
    '    METHODS revision RETURNING VALUE(rv_revision) TYPE i.',
    '  PROTECTED SECTION.',
    '  PRIVATE SECTION.',
    'ENDCLASS.',
    '',
    `CLASS ${lower} IMPLEMENTATION.`,
    '  METHOD revision.',
    `    rv_revision = ${revision}.`,
    '  ENDMETHOD.',
    'ENDCLASS.',
  ].join('\n');
}

async function main(): Promise<void> {
  const logger = createConnectionLogger();

  // The config loader is plain JS with no declaration file; naming the two
  // fields this probe reads is the whole of the type it needs.
  const { getEnvironmentConfig } =
    require('../src/__tests__/helpers/test-helper') as {
      getEnvironmentConfig: () => {
        default_package?: string;
        default_transport?: string;
      };
    };
  const env = getEnvironmentConfig();

  const className = (process.argv[2] ?? 'ZAC_PROBE_2UPD').toUpperCase();
  const packageName: string = env?.default_package ?? '';
  const transportRequest: string | undefined =
    env?.default_transport || undefined;

  if (!packageName) {
    say('No package. Set environment.default_package in test-config.yaml.');
    process.exitCode = 1;
    return;
  }

  say(`class     ${className}`);
  say(`package   ${packageName}`);
  say(`transport ${transportRequest ?? '(none)'}`);
  say(`system    ${process.env.SAP_URL ?? '(unset)'}`);
  say('');

  const connection = await createTestConnection(logger);
  const { client } = await createTestAdtClient(connection, logger);
  const cls = client.getClass();
  const config = { className, packageName, transportRequest };

  const steps: IStep[] = [];
  const handles: string[] = [];

  try {
    // ---- make sure there is something to update -------------------------
    const existing = await cls.read({ className }, 'active');
    const present = existing.ok && String(existing.getResult().value) !== '';
    say(present ? '· class is there' : '· class is not there — creating it');

    if (!present) {
      const created = await step('create', () =>
        cls.create({ ...config, description: 'Two-update-cycle probe' }),
      );
      steps.push(created.record);
      if (!created.record.ok) {
        say(`  create failed: ${created.record.detail}`);
      }
    }

    // ---- the two cycles --------------------------------------------------
    for (const revision of [1, 2]) {
      say('');
      say(`── cycle ${revision} ──────────────────────────────────────`);

      const locked = await step(
        `lock #${revision}`,
        () => cls.lock({ className }),
        (handle) => `handle=${handle}`,
      );
      steps.push(locked.record);
      say(
        `  lock     ${locked.record.ok ? '✓' : '✗'} ${locked.record.ms}ms  ${locked.record.detail}`,
      );

      if (!locked.record.ok) {
        // The refusal here is the finding. Nothing after it means anything.
        say(
          '  → the window could not be opened; skipping the rest of this cycle',
        );
        continue;
      }
      const handle = locked.value as string;
      handles.push(handle);

      const updated = await step(`update #${revision}`, () =>
        cls.update(config, {
          sourceCode: sourceFor(className, revision),
          lockHandle: handle,
        }),
      );
      steps.push(updated.record);
      say(
        `  update   ${updated.record.ok ? '✓' : '✗'} ${updated.record.ms}ms  ${updated.record.detail}`,
      );

      const unlocked = await step(`unlock #${revision}`, () =>
        cls.unlock({ className }, handle),
      );
      steps.push(unlocked.record);
      say(
        `  unlock   ${unlocked.record.ok ? '✓' : '✗'} ${unlocked.record.ms}ms  ${unlocked.record.detail}`,
      );

      const activated = await step(`activate #${revision}`, () =>
        cls.activate({ className }),
      );
      steps.push(activated.record);
      say(
        `  activate ${activated.record.ok ? '✓' : '✗'} ${activated.record.ms}ms  ${activated.record.detail}`,
      );
    }

    // ---- is the window actually shut? ------------------------------------
    //
    // The one question the two green cycles cannot answer between them. An
    // update carries the handle as given, including not at all, and this
    // library does not stand in front of the server with an opinion — so the
    // server answers it. A refusal here is the good outcome: it means the
    // enqueue the last unlock released is really gone.
    say('');
    say('── after the window ────────────────────────────────');
    const naked = await step('update (no handle)', () =>
      cls.update(config, { sourceCode: sourceFor(className, 3) }),
    );
    steps.push(naked.record);
    say(
      naked.record.ok
        ? `  ! ADT ACCEPTED a write with no lock handle (${naked.record.ms}ms) — the object is writable outside a window`
        : `  ✓ refused, as a released object should be: ${naked.record.detail}`,
    );

    // ---- what the system actually has now --------------------------------
    say('');
    say('── read-back ───────────────────────────────────────');
    const after = await cls.read({ className }, 'active');
    if (!after.ok) {
      say(
        `  active read failed: [${after.getError().origin}] ${after.getError().message}`,
      );
    } else {
      const source = String(after.getResult().value);
      const found = /rv_revision\s*=\s*(\d+)/.exec(source)?.[1];
      say(`  active source carries revision ${found ?? '(none found)'}`);
      say(
        found === '2'
          ? '  ✓ the second write is what the system has'
          : `  ✗ expected revision 2, the system has ${found ?? 'nothing'}`,
      );
    }
  } finally {
    await releaseTestConnection(connection);
  }

  // ---- summary -----------------------------------------------------------
  say('');
  say('── summary ─────────────────────────────────────────');
  for (const s of steps) {
    say(
      `  ${s.ok ? '✓' : '✗'} ${s.name.padEnd(12)} ${String(s.ms).padStart(6)}ms  ${s.detail}`,
    );
  }
  if (handles.length === 2) {
    say('');
    say(
      handles[0] === handles[1]
        ? `  both cycles got the same handle ${handles[0]} — expected: the handle is the session's, not the window's`
        : `  the two cycles got different handles (${handles[0]} then ${handles[1]}) — unusual on one session, worth a look`,
    );
  }
  // The no-handle update is expected to be refused, so it is not counted as a
  // failure — a probe that exits non-zero on its own control case is noise.
  const failed = steps.filter((s) => !s.ok && s.name !== 'update (no handle)');
  say('');
  say(
    failed.length === 0
      ? '  all steps ok'
      : `  ${failed.length} step(s) failed`,
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  say(`probe failed: ${String((error as Error).stack ?? error)}`);
  process.exitCode = 1;
});
