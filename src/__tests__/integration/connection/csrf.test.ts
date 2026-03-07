/**
 * CSRF Token diagnostics test
 *
 * Tests CSRF token fetch behavior and logs full request/response headers
 * for debugging connection issues across different SAP systems.
 *
 * Uses connection.makeAdtRequest() instead of raw axios so that
 * authentication (Basic / JWT) is handled automatically on all system types.
 *
 * Checks multiple endpoints:
 * - /sap/bc/adt/core/discovery (used by connection package)
 * - /sap/bc/adt/discovery (fallback for older systems)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import { getConfig } from '../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createTestsLogger,
} from '../../helpers/testLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger = createConnectionLogger();
const testsLogger = createTestsLogger();

describe('CSRF Token diagnostics', () => {
  let connection: IAbapConnection;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      hasConfig = true;
    } catch (_error) {
      testsLogger.warn(
        'Skipping tests: No .env file or SAP configuration found',
      );
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      (connection as any).reset();
    }
  });

  it('should fetch CSRF token from available endpoints', async () => {
    if (!hasConfig) return;

    // CSRF tokens are an HTTP concept — not applicable over RFC transport
    const config = getConfig();
    if ((config as any).connectionType === 'rfc') {
      console.log('Skipping CSRF test: RFC connections do not use CSRF tokens');
      return;
    }

    const baseUrl = process.env.SAP_URL!;
    console.log('\n=== CSRF Token Diagnostic ===');
    console.log(`System: ${baseUrl}`);

    const endpoints = ['/sap/bc/adt/core/discovery', '/sap/bc/adt/discovery'];

    const results: Record<string, string | undefined> = {};

    for (const endpoint of endpoints) {
      console.log(`\n--- Trying: ${endpoint} ---`);
      try {
        const response = await connection.makeAdtRequest({
          url: endpoint,
          method: 'GET',
          timeout: 30000,
          headers: {
            'x-csrf-token': 'fetch',
            Accept: 'application/atomsvc+xml',
          },
        });

        const status = response.status;
        const contentType = response.headers?.['content-type'] ?? '';
        const csrfToken = response.headers?.['x-csrf-token'] as
          | string
          | undefined;

        console.log(`  Status: ${status}`);
        console.log(`  Content-Type: ${contentType}`);
        console.log(`  x-csrf-token: ${csrfToken || 'NOT FOUND'}`);

        results[endpoint] = csrfToken || undefined;
      } catch (error: unknown) {
        console.log(`\n--- ${endpoint} ERROR ---`);
        const message = error instanceof Error ? error.message : String(error);
        console.log(`  ${message}`);
        const err = error as {
          response?: { status?: number; headers?: Record<string, string> };
        };
        if (err.response) {
          console.log(`  Status: ${err.response.status}`);

          // Even failed requests may carry a CSRF token
          const csrfToken = err.response.headers?.['x-csrf-token'];
          if (csrfToken) {
            console.log(`  x-csrf-token (from error): ${csrfToken}`);
            results[endpoint] = csrfToken;
          }
        }
      }
    }

    // Summary
    console.log('\n=== Summary ===');
    for (const [endpoint, token] of Object.entries(results)) {
      console.log(
        `  ${endpoint}: ${token ? `OK (${token.substring(0, 20)}...)` : 'FAILED'}`,
      );
    }

    // At least one endpoint should return CSRF
    const anyToken = Object.values(results).find((t) => t);
    console.log(
      `\n  Result: ${anyToken ? 'CSRF token available' : 'NO CSRF token from any endpoint'}`,
    );
    console.log('=== End Diagnostic ===\n');

    expect(anyToken).toBeTruthy();
  }, 60000);
});
