/**
 * Read function module: source code + metadata
 *
 * Usage:
 *   npx ts-node scripts/read-function-module.ts DDIF_TABL_PUT --group=SDIF
 *   npx ts-node scripts/read-function-module.ts Z_AC_SHR_FM01 --group=ZAC_SHR_FUGR
 *
 * Environment variables:
 *   MCP_ENV_PATH - Path to .env file (default: .env in project root)
 */

import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import { AdtClient } from '../src/clients/AdtClient';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';
import {
  createBuilderLogger,
  createConnectionLogger,
  createTestsLogger,
} from '../src/__tests__/helpers/testLogger';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger = createConnectionLogger();
const builderLogger = createBuilderLogger();
const log = createTestsLogger();

function parseArgs(argv: string[]): {
  functionModuleName: string;
  functionGroupName: string;
} {
  let name: string | undefined;
  let group: string | undefined;

  for (const arg of argv) {
    if (arg.startsWith('--group=')) {
      group = arg.slice('--group='.length).trim();
    } else if (!arg.startsWith('--') && !name) {
      name = arg.trim();
    }
  }

  if (!name) {
    throw new Error(
      'Usage: npx ts-node scripts/read-function-module.ts <FM_NAME> --group=<FUGR_NAME>',
    );
  }
  if (!group) {
    throw new Error('--group=<function_group_name> is required');
  }

  return { functionModuleName: name, functionGroupName: group };
}

async function run(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { functionModuleName, functionGroupName } = args;

  console.log(`\n=== Reading Function Module: ${functionModuleName} ===`);
  console.log(`    Function Group: ${functionGroupName}\n`);

  const config = getConfig();
  const connection = createAbapConnection(config, connectionLogger);
  await (connection as any).connect();

  const client = new AdtClient(connection, builderLogger);
  const fm = client.getFunctionModule();

  // 1. Read source code
  console.log('--- SOURCE CODE ---');
  try {
    const sourceState = await fm.read({
      functionModuleName,
      functionGroupName,
    });
    if (sourceState?.readResult) {
      const source =
        typeof sourceState.readResult === 'string'
          ? sourceState.readResult
          : (sourceState.readResult as any)?.data || '';
      console.log(source);
      console.log(`\n[Source length: ${source.length} characters]`);
    } else {
      console.log('[No source code returned]');
    }
  } catch (error: any) {
    console.error(
      `[Source read failed: HTTP ${error.response?.status || '?'} ${error.message}]`,
    );
  }

  // 2. Read metadata
  console.log('\n--- METADATA ---');
  try {
    const metaState = await fm.readMetadata({
      functionModuleName,
      functionGroupName,
    });
    if (metaState?.metadataResult) {
      const meta = metaState.metadataResult;
      // Print response status and headers
      console.log(`HTTP Status: ${meta.status}`);
      const contentType = meta.headers?.['content-type'] || '';
      if (contentType) {
        console.log(`Content-Type: ${contentType}`);
      }

      // Print parsed data
      const data = meta.data;
      if (typeof data === 'string') {
        console.log(data);
      } else if (data) {
        console.log(JSON.stringify(data, null, 2));
      }
    } else {
      console.log('[No metadata returned]');
    }
  } catch (error: any) {
    console.error(
      `[Metadata read failed: HTTP ${error.response?.status || '?'} ${error.message}]`,
    );
  }

  (connection as any).reset();
}

run().catch((error) => {
  console.error('Script failed:', error?.message || error);
  process.exit(1);
});
