/**
 * Does a check-with-source for an object that does not exist need
 * `chkrun:version="new"`?
 *
 * It matters because the public `check()` members coerce the version to
 * `active | inactive`, so if `new` is the only one the server accepts for an
 * absent object, the use case is unreachable through the library.
 *
 *   npx ts-node scripts/probe-checkrun-version.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import {
  type CheckRunVersion,
  parseCheckRunResponse,
  runCheckRunWithSource,
} from '../src/utils/checkRun';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const CASES: Array<{ type: string; name: string; source: string }> = [
  {
    type: 'program',
    name: 'ZZ_NOSUCH_PRG',
    source: 'REPORT zz_nosuch_prg.\nTHIS IS NOT ABAP AT ALL.',
  },
  {
    type: 'function_group',
    name: 'ZZ_NOSUCH_FG',
    source: 'FUNCTION-POOL zz_nosuch_fg.\nTHIS IS NOT ABAP AT ALL.',
  },
  {
    type: 'structure',
    name: 'ZZ_NOSUCH_STRU',
    source: 'define structure zz_nosuch_stru { this is not a field list }',
  },
  {
    type: 'service_definition',
    name: 'ZZ_NOSUCH_SRVD',
    source: 'define service ZZ_NOSUCH_SRVD { this is not an expose list }',
  },
];

async function main(): Promise<void> {
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    for (const c of CASES) {
      for (const version of [
        'new',
        'inactive',
        'active',
      ] as CheckRunVersion[]) {
        const response = await runCheckRunWithSource(
          connection,
          c.type,
          c.name,
          c.source,
          version,
        );
        const report = parseCheckRunResponse(response);
        // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
        console.log(
          `${c.type.padEnd(20)} version=${version.padEnd(9)} ${report.status.padEnd(13)} "${report.message}" msgs=${report.errors.length + report.warnings.length}`,
        );
      }
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error);
  process.exit(1);
});
