/**
 * Why did a package that exists answer an empty node structure?
 *
 * The walk in `scripts/lib/packageWalk.ts` used to raise for an empty body and
 * say it meant the package did not exist. A package answering `200` with its
 * own document on `/packages/{name}` answered empty here, so that sentence was
 * wrong and the walk no longer says it. This asks the endpoint directly, for
 * the root the walk starts from and for the child that came back empty.
 *
 * Usage:
 *   npx ts-node scripts/probe-nodestructure.ts [PKG ...]
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
  fetchNodeStructure,
  parseNodeStructure,
} from '../src/core/shared/nodeStructure';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const packages =
  process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : ['ZADT_BLD_PKG03', 'ZAC_INNER_PKG03', 'ZAC_SHR_PKG'];

async function main(): Promise<void> {
  const connection = await createTestConnection(createConnectionLogger());
  try {
    for (const name of packages) {
      const root = await fetchNodeStructure(
        connection,
        'DEVC/K',
        name,
        undefined,
        true,
      );
      const xml =
        typeof root.data === 'string'
          ? root.data
          : JSON.stringify(root.data ?? '');
      process.stdout.write(
        `\n=== ${name}: status ${root.status}, ${xml.length} bytes\n`,
      );
      if (xml.trim().length === 0) {
        process.stdout.write('    (empty body)\n');
        continue;
      }
      const { nodes, objectTypes } = parseNodeStructure(xml);
      process.stdout.write(
        `    nodes ${nodes.length}, objectTypes ${objectTypes.length}\n`,
      );
      process.stdout.write(
        `    types: ${objectTypes.map((t) => `${t.objectType}#${t.nodeId}`).join(', ') || '(none)'}\n`,
      );
      process.stdout.write(
        `    direct: ${
          nodes
            .map((n) => `${n.OBJECT_TYPE}:${n.OBJECT_NAME}`)
            .slice(0, 15)
            .join(', ') || '(none)'
        }\n`,
      );
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `probe failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
