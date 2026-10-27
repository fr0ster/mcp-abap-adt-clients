/**
 * Does this object exist, and what does its source say?
 *
 * One GET. For confirming that a shared dependency a run needs is actually on
 * the system — a green `shared:setup` that printed nothing is not evidence.
 *
 *   ../../node_modules/.bin/ts-node scripts/probe-object.ts CLAS/OC ZAC_CLS023
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AdtSourceTypeCode } from '@mcp-abap-adt/interfaces-adt';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import {
  adtTypeCode,
  isSourceTypeCode,
} from '../src/__tests__/helpers/typeCode';
import { AdtClient } from '../src/clients/AdtClient';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

/** A command-line argument, checked once: a code of the tables with a source. */
function sourceTypeCode(value: string): AdtSourceTypeCode {
  const code = adtTypeCode(value);
  if (!isSourceTypeCode(code)) {
    throw new Error(`${code} has no source the library reads`);
  }
  return code;
}

async function main(): Promise<void> {
  const [type, name, functionGroup] = process.argv.slice(2);
  if (!type || !name) {
    // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
    console.log('usage: probe-object.ts <type> <NAME> [FUNCTION_GROUP]');
    return;
  }
  const logger = createConnectionLogger();
  const connection = await createTestConnection(logger);
  try {
    const answer = await new AdtClient(connection, logger)
      .getUtils()
      .readObjectSource(sourceTypeCode(type), name, functionGroup);
    if (!answer.ok) {
      const failure = answer.getError();
      // biome-ignore lint/suspicious/noConsole: same
      console.log(`${name}: [${failure.origin}] ${failure.message}`);
      return;
    }
    const source = answer.getResult().value;
    // biome-ignore lint/suspicious/noConsole: same
    console.log(`${name}: ${source.length} bytes`);
    // biome-ignore lint/suspicious/noConsole: same
    console.log(source.slice(0, 400));
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
