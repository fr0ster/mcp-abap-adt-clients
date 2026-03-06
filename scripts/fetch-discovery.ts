/**
 * Fetch ADT discovery XML from SAP systems for comparison.
 * Usage: npx ts-node scripts/fetch-discovery.ts
 *
 * Set MCP_ENV_PATH to switch systems (default: .env)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import * as dotenv from 'dotenv';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

// Re-use the same config helper as tests
const sessionConfigPath = path.resolve(__dirname, '../src/__tests__/helpers/sessionConfig');
const { getConfig } = require(sessionConfigPath);

const ENDPOINTS = [
  '/sap/bc/adt/core/discovery',
  '/sap/bc/adt/discovery',
];

async function main() {
  const config = getConfig();

  console.log(`Connecting to ${config.url} (client ${config.client})...`);

  const connection = createAbapConnection(config);
  await (connection as any).connect();

  const systemLabel = process.env.SAP_SYSTEM_LABEL || 'system';

  for (const endpoint of ENDPOINTS) {
    console.log(`\nFetching ${endpoint}...`);
    try {
      const response = await connection.makeAdtRequest({
        url: endpoint,
        method: 'GET',
        timeout: 30000,
        headers: { Accept: 'application/atomsvc+xml' },
      });

      const contentType = String(response.headers?.['content-type'] || '');
      const data = String(response.data || '');

      if (contentType.includes('xml') && data.length > 100) {
        const filename = `discovery_${systemLabel}_${endpoint.replace(/\//g, '_')}.xml`;
        const outPath = path.resolve(__dirname, filename);
        fs.writeFileSync(outPath, data, 'utf-8');
        console.log(`  Saved to ${filename} (${data.length} bytes)`);
      } else {
        console.log(`  Not XML or empty. Content-Type: ${contentType}, length: ${data.length}`);
      }
    } catch (error: any) {
      console.log(`  Failed: ${error.message}`);
    }
  }

  process.exit(0);
}

main().catch(console.error);
