/**
 * Jest globalSetup — SAP connection preflight check.
 *
 * Validates SAP connectivity once before any test file runs.
 * If SAP_URL is configured but unreachable — fails the entire suite immediately
 * with a clear error instead of letting 24+ test files silently skip.
 */

const { loadTestEnv } = require('./test-helper');

import {
  createTestConnection,
  getConfig,
  getTargetSystem,
} from './sessionConfig';

/** Milliseconds the preflight may spend before it gives up. */
const PREFLIGHT_TIMEOUT_MS = Number(
  process.env.SAP_PREFLIGHT_TIMEOUT_MS ?? 10000,
);

interface JestGlobalConfig {
  testPathPatterns?: { patterns?: string[] };
  testNamePattern?: string;
}

/**
 * Whether this run selected unit tests only.
 *
 * The preflight exists so an integration run fails once and clearly instead of
 * 24+ files skipping silently. A unit run needs no SAP at all, and making it
 * depend on one is how `npx jest src/__tests__/unit` came to abort — or, where
 * the configured host merely accepts a socket and says nothing, sit there.
 *
 * Read from the config jest HANDS us, not from `process.argv`. The first attempt
 * sniffed argv and got this wrong in a way worth remembering: `npx jest -t "some
 * name"` passes no path at all, so argv held no pattern, the check concluded
 * "not a unit run", and the preflight ran anyway. Filtering one unit test by
 * name is an ordinary thing to do, and it waited on SAP to do it.
 *
 * With no path pattern the selection genuinely spans every file, integration
 * included, so the preflight is right to run — but it must then say so before it
 * waits, which is what the caller sees below.
 */
function unitOnlyRun(globalConfig?: JestGlobalConfig): boolean {
  const patterns = globalConfig?.testPathPatterns?.patterns ?? [];
  return (
    patterns.length > 0 &&
    patterns.every((p) => /(^|[/\\])unit([/\\]|$)/.test(p))
  );
}

/** Rejects if `work` has not settled within `ms`. The timer never holds the process. */
async function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                `preflight did not answer within ${ms}ms (override with SAP_PREFLIGHT_TIMEOUT_MS)`,
              ),
            ),
          ms,
        );
        timer.unref();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * The one place this file writes to stdout.
 *
 * globalSetup has no injected logger and no injection point: it runs before any
 * test context exists, and when it aborts the suite, speaking IS the job. So the
 * `noConsole` rule cannot be satisfied here the way library code satisfies it —
 * but it can be confined. Five scattered violations became one, with the reason
 * written down instead of inferred.
 */
function say(message: string): void {
  // biome-ignore lint/suspicious/noConsole: test bootstrap, no logger to inject
  console.log(message);
}

export default async function globalSetup(globalConfig?: JestGlobalConfig) {
  loadTestEnv();

  // No SAP_URL → skip preflight, tests will self-skip via hasConfig=false
  if (!process.env.SAP_URL) {
    say('[globalSetup] SAP_URL not configured — skipping preflight');
    return;
  }

  if (process.env.SKIP_SAP_PREFLIGHT === '1') {
    say('[globalSetup] SKIP_SAP_PREFLIGHT=1 — skipping preflight');
    return;
  }

  if (unitOnlyRun(globalConfig)) {
    say('[globalSetup] unit-only run — skipping SAP preflight');
    return;
  }

  const config = getConfig();
  // Which system, asked BEFORE the try. It reads test-config.yaml and throws
  // when the answer is missing — a configuration fault, and one that must not
  // arrive dressed as "SAP is unreachable" with a message about checking the
  // network.
  const system = getTargetSystem();
  // Says what it is about to wait for and for how long, BEFORE waiting. Silence
  // is what turned a slow host into a bug report against an unrelated test: the
  // suite's testTimeout is 15 minutes, so a wait with no explanation is
  // indistinguishable from a hang.
  say(
    `[globalSetup] Checking SAP connectivity: ${config.url} (${system}) ` +
      `(up to ${PREFLIGHT_TIMEOUT_MS}ms; SKIP_SAP_PREFLIGHT=1 to skip, ` +
      `SAP_PREFLIGHT_TIMEOUT_MS to change) ...`,
  );

  try {
    // Bounded as a whole, not per request. connect() carries its own retries, so
    // a host that accepts a socket and then says nothing can outlast any single
    // request timeout — and an unbounded preflight is worse than a failing one:
    // it produces no output for 15 minutes and reads as a hung test.
    await withTimeout(
      (async () => {
        // Through the same helper the tests use, and therefore opening a
        // session the same way they will. It is also no longer optional: since
        // connection 5.0.0 a request on a connection nobody opened is refused
        // before it is sent, so the old build-and-request preflight would have
        // reported every system, reachable or not, as unreachable.
        const connection = await createTestConnection();
        try {
          await connection.makeAdtRequest({
            url: '/sap/bc/adt/discovery',
            method: 'GET',
            headers: { Accept: 'application/atomsvc+xml' },
            timeout: 15000,
          });
        } finally {
          // Released, not left to time out: the preflight's session is of no
          // use to anyone, and the pool it comes from is shared per user.
          await connection.disconnect();
        }
      })(),
      PREFLIGHT_TIMEOUT_MS,
    );
    say('[globalSetup] SAP connection OK');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(
      `[globalSetup] SAP is unreachable — aborting all tests.\n` +
        `  URL: ${config.url}\n` +
        `  Error: ${msg}\n\n` +
        `Fix SAP connection before running integration tests.`,
    );
  }
}
