/**
 * Two consecutive writes to one class, each with its own lock → update →
 * unlock → activate — on one session, or on two.
 *
 * **Why a second cycle, and not just one.** Since the "one endpoint, one
 * member" change the lock window is the caller's sequence, not something
 * `update` composes behind their back. That makes the first cycle prove very
 * little on its own: a `lock` that answers a handle, a PUT that answers 200 and
 * an `unlock` that answers 200 all look identical whether or not the enqueue
 * was actually released. The second window on the same object is the only thing
 * that can tell the difference.
 *
 * **The lock handle is not the evidence.** Measured on a cloud trial: two
 * cycles inside one process get the *same* handle, and a fresh process against
 * the same class gets a different one (9A97E458…, D1AFDC1F…, BD3C75F5…). The
 * handle belongs to the session, not to the window, so comparing the two tells
 * you nothing about whether the first window closed. What does tell you is the
 * step after the last unlock: an update attempted with no handle at all. If ADT
 * refuses it — 423, "Resource CLASS … is not locked" — the enqueue is gone.
 *
 * **`--sessions=2` is the other half of the question.** One session answers
 * whether a window closes; two answer what crosses a session boundary. The
 * second run opens a fresh connection for the second cycle and, before locking
 * anything, offers session A's handle to session B. A refusal there is what
 * makes "the handle belongs to the session" a measurement rather than an
 * inference drawn from two hex strings that happened to match. It also shows
 * whether a `disconnect()` on cloud really ends the ADT session: run it under
 * `WIRE_LOG` and count `sap-contextid` — two distinct values means it does.
 *
 * Exactly two sessions, opened one after the other and never at once. The trial
 * refuses a third, and churning connections is not something to do for its own
 * sake — this is a measurement with a fixed cost, not a pattern to copy.
 *
 *   MCP_ENV_PATH=~/.config/mcp-abap-adt/sessions/trial.env \
 *     npx ts-node scripts/probe-two-update-cycles.ts [ZAC_CLS_NAME] [--sessions=2]
 *
 * Add `WIRE_LOG=probe-wire.txt` to see the cookies and the session type header.
 *
 * The class is created if it is not there, and left behind either way — a probe
 * you can run twice is worth more than one that cleans up.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import type { AdtClient } from '../src/clients/AdtClient';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

function say(line: string): void {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.log(line);
}

/** What one step produced. */
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
 * point is to reach the *second* window and see what it says.
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

/**
 * What an activation actually said.
 *
 * A 200 is not the verdict and neither is the absence of a throw:
 * `activationExecuted="false"` means ADT decided there was nothing to do, and
 * only a `<msg type="E">` is a refusal. `activate` answers the document as it
 * arrived, so both are readable here rather than guessed at.
 */
function readActivation(document: unknown): string {
  const xml = String(document);
  const flag = (name: string): string =>
    new RegExp(`${name}="([^"]*)"`).exec(xml)?.[1] ?? '?';
  const messages = xml.match(/<[a-z]*:?msg\b/gi)?.length ?? 0;
  const errors = xml.match(/type="E"/g)?.length ?? 0;
  return (
    `check=${flag('checkExecuted')} activation=${flag('activationExecuted')} ` +
    `generation=${flag('generationExecuted')} msgs=${messages} errors=${errors}`
  );
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

interface IClassConfigLite {
  className: string;
  packageName: string;
  transportRequest?: string;
}

/** A connection with the class handler already built on it. */
interface ISession {
  connection: IAbapConnection;
  client: AdtClient;
  cls: ReturnType<AdtClient['getClass']>;
}

async function openSession(label: string): Promise<ISession> {
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  const { client } = await createTestAdtClient(connection, logger);
  say(`· session ${label} open`);
  return { connection, client, cls: client.getClass() };
}

/** One lock → update → unlock → activate window, reported step by step. */
async function runCycle(
  session: ISession,
  config: IClassConfigLite,
  revision: number,
  steps: IStep[],
): Promise<string | undefined> {
  const { cls } = session;
  const { className } = config;

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
    say('  → the window could not be opened; skipping the rest of this cycle');
    return undefined;
  }
  const handle = locked.value as string;

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

  const activated = await step(
    `activate #${revision}`,
    () => cls.activate({ className }),
    readActivation,
  );
  steps.push(activated.record);
  say(
    `  activate ${activated.record.ok ? '✓' : '✗'} ${activated.record.ms}ms  ${activated.record.detail}`,
  );

  // **Did this write land?** The read-back at the end of the run can only ever
  // show the last revision, so on its own it is consistent with the first write
  // never having happened — the second would overwrite either way. Asking after
  // each cycle is what makes both changes evidence rather than one change and an
  // assumption.
  const seen = await step(
    `verify #${revision}`,
    () => cls.read({ className }, 'active'),
    (source) =>
      `active carries revision ${/rv_revision\s*=\s*(\d+)/.exec(String(source))?.[1] ?? '(none)'}`,
  );
  steps.push(seen.record);
  const landed = seen.record.detail.endsWith(`revision ${revision}`);
  // A read that succeeded while carrying the wrong revision is a failure of
  // this step, not a success — the summary must not show it green.
  seen.record.ok = seen.record.ok && landed;
  say(
    `  verify   ${landed ? '✓' : '✗'} ${seen.record.ms}ms  ${seen.record.detail}`,
  );

  return handle;
}

async function main(): Promise<void> {
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

  const args = process.argv.slice(2);
  const sessionCount = args.some(
    (a) => a === '--sessions=2' || a === '--two-sessions',
  )
    ? 2
    : 1;
  const className = (
    args.find((a) => !a.startsWith('--')) ?? 'ZAC_PROBE_2UPD'
  ).toUpperCase();
  const packageName = env?.default_package ?? '';
  const transportRequest = env?.default_transport || undefined;

  if (!packageName) {
    say('No package. Set environment.default_package in test-config.yaml.');
    process.exitCode = 1;
    return;
  }

  const config: IClassConfigLite = { className, packageName, transportRequest };

  say(`class     ${className}`);
  say(`package   ${packageName}`);
  say(`transport ${transportRequest ?? '(none)'}`);
  say(`system    ${process.env.SAP_URL ?? '(unset)'}`);
  say(
    `sessions  ${sessionCount}${sessionCount === 2 ? '  (one per cycle)' : '  (one for the whole run)'}`,
  );
  say('');

  const steps: IStep[] = [];
  const handles: (string | undefined)[] = [];
  let session = await openSession('A');
  let crossSession: IStep | undefined;

  try {
    // ---- make sure there is something to update -------------------------
    const existing = await session.cls.read({ className }, 'active');
    const present = existing.ok && String(existing.getResult().value) !== '';
    say(present ? '· class is there' : '· class is not there — creating it');
    if (!present) {
      const created = await step('create', () =>
        session.cls.create({
          ...config,
          description: 'Two-update-cycle probe',
        }),
      );
      steps.push(created.record);
      if (!created.record.ok) say(`  create failed: ${created.record.detail}`);
    }

    // ---- cycle 1 ---------------------------------------------------------
    say('');
    say('── cycle 1 ──────────────────────────────────────');
    handles.push(await runCycle(session, config, 1, steps));

    // ---- the session boundary, when there is one -------------------------
    if (sessionCount === 2) {
      say('');
      say('── session boundary ────────────────────────────');
      await releaseTestConnection(session.connection);
      say('· session A released');
      session = await openSession('B');

      // Only possible with two sessions: offer A's handle to B. If B is
      // allowed to write with it, a handle outlives the session that took it,
      // and every "the handle is the session's" reading above is wrong.
      const handleA = handles[0];
      if (handleA) {
        const carried = await step("update (session A's handle in B)", () =>
          session.cls.update(config, {
            sourceCode: sourceFor(className, 9),
            lockHandle: handleA,
          }),
        );
        crossSession = carried.record;
        say(
          carried.record.ok
            ? `  ! B ACCEPTED A's handle (${carried.record.ms}ms) — a handle outlives its session`
            : `  ✓ refused, as a handle from a dead session should be: ${carried.record.detail}`,
        );
      }
    }

    // ---- cycle 2 ---------------------------------------------------------
    say('');
    say('── cycle 2 ──────────────────────────────────────');
    handles.push(await runCycle(session, config, 2, steps));

    // ---- is the window actually shut? ------------------------------------
    //
    // An update carries the handle as given, including not at all, and this
    // library does not stand in front of the server with an opinion — so the
    // server answers it. A refusal here is the good outcome: it means the
    // enqueue the last unlock released is really gone.
    say('');
    say('── after the window ────────────────────────────────');
    const naked = await step('update (no handle)', () =>
      session.cls.update(config, { sourceCode: sourceFor(className, 3) }),
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
    const after = await session.cls.read({ className }, 'active');
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
    await releaseTestConnection(session.connection);
  }

  // ---- summary -----------------------------------------------------------
  say('');
  say('── summary ─────────────────────────────────────────');
  for (const s of steps) {
    say(
      `  ${s.ok ? '✓' : '✗'} ${s.name.padEnd(12)} ${String(s.ms).padStart(6)}ms  ${s.detail}`,
    );
  }
  if (crossSession) {
    say(
      `  ${crossSession.ok ? '✗' : '✓'} ${crossSession.name}  ${crossSession.detail}`,
    );
  }

  const [first, second] = handles;
  if (first && second) {
    say('');
    if (sessionCount === 1) {
      say(
        first === second
          ? `  both cycles got the same handle ${first} — expected: the handle is the session's, not the window's`
          : `  the two cycles got different handles (${first} then ${second}) — unusual on one session, worth a look`,
      );
    } else {
      say(
        first === second
          ? `  ! both sessions got the SAME handle ${first} — session A was not really ended`
          : `  the two sessions got different handles (${first} then ${second}), as separate sessions should`,
      );
    }
  }

  // The no-handle update and the carried handle are expected to be refused, so
  // neither is counted as a failure — a probe that exits non-zero on its own
  // control cases is noise.
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
