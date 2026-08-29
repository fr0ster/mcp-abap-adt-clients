/**
 * One parsed trace entry, printed field by field.
 *
 * The types say `IAbapTraceEntry` carries fourteen fields and that four of them
 * are required. Nothing validates that at runtime — this library maps and does
 * not judge — so a field the wire omits arrives as `undefined` **despite** the
 * type saying otherwise. Compile-time proof does not reach that far, and the
 * parser tests are transcribed from a capture rather than taken from a live
 * read.
 *
 * So this prints what a real system actually produced, which is the only way to
 * tell a typed field from an honoured one.
 *
 *   npx ts-node scripts/print-trace-entry.ts
 *
 * Credentials and target come from the same `.env` and `test-config.yaml` the
 * tests use. Read-only: one GET of the trace feed, nothing written.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { refuseWhileRunOwnsSession } from '../src/__tests__/helpers/sharedSession';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtRuntimeClient } from '../src/clients/AdtRuntimeClient';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

async function main() {
  refuseWhileRunOwnsSession();

  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const profiler = new AdtRuntimeClient(connection, logger).getProfiler();
    const entries = await profiler.list();

    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log(`\n${entries.length} trace(s) in the feed\n`);
    if (entries.length === 0) {
      // biome-ignore lint/suspicious/noConsole: same
      console.log(
        'Nothing to print. Run something with profiling first, or widen the user filter.\n',
      );
      return;
    }

    const [entry] = entries;
    const missing: string[] = [];
    for (const [field, value] of Object.entries(entry)) {
      if (value === undefined) {
        missing.push(field);
      }
      // biome-ignore lint/suspicious/noConsole: same
      console.log(
        `  ${field.padEnd(18)} ${value === undefined ? '— MISSING —' : JSON.stringify(value)}`,
      );
    }

    // biome-ignore lint/suspicious/noConsole: same
    console.log(
      missing.length === 0
        ? '\nEvery field the contract declares was present.\n'
        : `\nMissing, though the contract declares them: ${missing.join(', ')}\n` +
            'That is a type claiming more than the wire gives. Report it — the ' +
            'fix is to relax the contract, not to paper over it here.\n',
    );
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  const e = error as { message?: string; response?: { status?: number } };
  const status = e.response?.status;
  // biome-ignore lint/suspicious/noConsole: a probe reports its own failure
  console.error(
    `\n${status ? `HTTP ${status}: ` : ''}${e.message ?? String(error)}\n`,
  );
  process.exit(1);
});
