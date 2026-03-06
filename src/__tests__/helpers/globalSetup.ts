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

export default async function globalSetup() {
  loadTestEnv();

  // No SAP_URL → skip preflight, tests will self-skip via hasConfig=false
  if (!process.env.SAP_URL) {
    console.log('[globalSetup] SAP_URL not configured — skipping preflight');
    return;
  }

  const config = getConfig();
  console.log(`[globalSetup] Checking SAP connectivity: ${config.url} ...`);

  try {
    const connection = createAbapConnection(config);
    await (connection as any).connect();
    await connection.makeAdtRequest({
      url: '/sap/bc/adt/discovery',
      method: 'GET',
      headers: { Accept: 'application/atomsvc+xml' },
      timeout: 15000,
    });
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
