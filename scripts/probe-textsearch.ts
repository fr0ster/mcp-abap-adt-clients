/**
 * Probe the ADT textsearch endpoint and dump raw responses for
 * researching response shape. Not a production API — used to inform the
 * searchSource() design (see issue #36).
 *
 * Usage:
 *   MCP_ENV_PATH=trial.env SAP_SYSTEM_LABEL=trial npx ts-node scripts/probe-textsearch.ts
 *   MCP_ENV_PATH=e19.env   SAP_SYSTEM_LABEL=e19   npx ts-node scripts/probe-textsearch.ts
 *
 * Optional: SEARCH_STRING (default 'SELECT'), PACKAGE_NAME, OBJECT_TYPE.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import * as dotenv from 'dotenv';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const sessionConfigPath = path.resolve(
  __dirname,
  '../src/__tests__/helpers/sessionConfig',
);
const { getConfig } = require(sessionConfigPath);

const SEARCH_STRING = process.env.SEARCH_STRING || 'SELECT';
const PACKAGE_NAME = process.env.PACKAGE_NAME || '';
const OBJECT_TYPE = process.env.OBJECT_TYPE || '';
const SYSTEM_LABEL = process.env.SAP_SYSTEM_LABEL || 'system';

function buildUrl(params: Record<string, string>): string {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `/sap/bc/adt/repository/informationsystem/textsearch?${qs}`;
}

async function probe(
  connection: any,
  label: string,
  url: string,
  accept: string,
) {
  console.log(`\n[${label}] GET ${url}`);
  console.log(`  Accept: ${accept}`);
  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: 60000,
      headers: { Accept: accept },
    });
    const contentType = String(response.headers?.['content-type'] || '');
    const data = String(response.data || '');
    console.log(`  -> ${response.status} ${contentType} ${data.length} bytes`);

    const outDir = path.resolve(__dirname, '../docs/discovery');
    fs.mkdirSync(outDir, { recursive: true });
    const ext = contentType.includes('json') ? 'json' : 'xml';
    const outPath = path.join(
      outDir,
      `textsearch_${SYSTEM_LABEL}_${label}.${ext}`,
    );
    fs.writeFileSync(outPath, data, 'utf-8');
    console.log(`  saved -> ${outPath}`);
  } catch (err: any) {
    console.log(`  FAILED: ${err.message}`);
    if (err.response) {
      console.log(`    status: ${err.response.status}`);
      console.log(
        `    body:   ${String(err.response.data || '').slice(0, 500)}`,
      );
    }
  }
}

async function main() {
  const config = getConfig();
  console.log(`Connecting to ${config.url} (client ${config.client})...`);
  const connection = createAbapConnection(config);
  await (connection as any).connect();

  // 1. Bare textsearch with default Accept (no Accept hint)
  await probe(
    connection,
    'bare',
    buildUrl({
      searchString: SEARCH_STRING,
      searchFromIndex: '1',
      searchToIndex: '20',
    }),
    'application/xml',
  );

  // 2. With package + objectType filters if provided
  if (PACKAGE_NAME || OBJECT_TYPE) {
    await probe(
      connection,
      'filtered',
      buildUrl({
        searchString: SEARCH_STRING,
        searchFromIndex: '1',
        searchToIndex: '20',
        packageName: PACKAGE_NAME,
        objectType: OBJECT_TYPE,
      }),
      'application/xml',
    );
  }

  // 3. Support endpoint (DB capabilities)
  await probe(
    connection,
    'support',
    '/sap/bc/adt/repository/informationsystem/textsearch/support',
    'application/xml',
  );

  // 4. objectnames / objecttypes helper endpoints
  await probe(
    connection,
    'objecttypes',
    '/sap/bc/adt/repository/informationsystem/textsearch/objecttypes',
    'application/xml',
  );

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
