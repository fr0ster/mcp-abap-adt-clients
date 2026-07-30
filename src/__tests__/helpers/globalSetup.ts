/**
 * Jest globalSetup — SAP connection preflight check.
 *
 * Validates SAP connectivity once before any test file runs.
 * If SAP_URL is configured but unreachable — fails the entire suite immediately
 * with a clear error instead of letting 24+ test files silently skip.
 */

const { loadTestEnv } = require('./test-helper');

import { createAbapConnection } from '@mcp-abap-adt/connection';
import { getConfig } from './sessionConfig';

/** Milliseconds the preflight may spend before it gives up. */
const PREFLIGHT_TIMEOUT_MS = Number(
  process.env.SAP_PREFLIGHT_TIMEOUT_MS ?? 20000,
);

/**
 * Whether this run selected unit tests only.
 *
 * The preflight exists so an integration run fails once and clearly instead of
 * 24+ files skipping silently. A unit run needs no SAP at all, and making it
 * depend on one is how `npx jest src/__tests__/unit` came to abort — or, where
 * the configured host merely does not answer, sit there: the suite's
 * `testTimeout` is 15 minutes, so an unreachable host is indistinguishable from
 * a hang, and the reported hang gets blamed on whichever test was next.
 *
 * Read from the CLI patterns rather than from an env var nobody will guess.
 */
function unitOnlyRun(): boolean {
  const patterns = process.argv
    .slice(2)
    .filter((arg) => !arg.startsWith('-'))
    .filter((arg) => !arg.endsWith('jest') && !arg.endsWith('jest.js'));
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

export default async function globalSetup() {
  loadTestEnv();

  // No SAP_URL → skip preflight, tests will self-skip via hasConfig=false
  if (!process.env.SAP_URL) {
    console.log('[globalSetup] SAP_URL not configured — skipping preflight');
    return;
  }

  if (unitOnlyRun()) {
    console.log('[globalSetup] unit-only run — skipping SAP preflight');
    return;
  }

  const config = getConfig();
  console.log(`[globalSetup] Checking SAP connectivity: ${config.url} ...`);

  try {
    // Bounded as a whole, not per request. connect() carries its own retries, so
    // a host that accepts a socket and then says nothing can outlast any single
    // request timeout — and an unbounded preflight is worse than a failing one:
    // it produces no output for 15 minutes and reads as a hung test.
    await withTimeout(
      (async () => {
        const connection = createAbapConnection(config);
        await (connection as any).connect();
        await connection.makeAdtRequest({
          url: '/sap/bc/adt/discovery',
          method: 'GET',
          headers: { Accept: 'application/atomsvc+xml' },
          timeout: 15000,
        });
      })(),
      PREFLIGHT_TIMEOUT_MS,
    );
    console.log('[globalSetup] SAP connection OK');
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
