/**
 * CSRF Token diagnostics test
 *
 * Tests CSRF token fetch behavior and logs full request/response headers
 * for debugging connection issues across different SAP systems.
 *
 * Uses connection.makeAdtRequest() instead of raw axios so that
 * authentication (Basic / JWT) is handled automatically on all system types.
 *
 * Checks both endpoints, each of which must answer a 2xx with a token:
 * - /sap/bc/adt/core/discovery (used by connection package)
 * - /sap/bc/adt/discovery
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import * as dotenv from 'dotenv';
import { gateOn } from '../../helpers/caseGate';
import {
  createTestConnection,
  getConnectionType,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
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

/**
 * What a token looks like, without being one.
 *
 * `present (32 chars)` answers everything this diagnostic asks — did the
 * endpoint issue a token, and is it the shape expected — while leaving nothing
 * usable in a log that gets pasted into an issue.
 */
function describeToken(token?: string): string {
  if (!token) return 'NOT FOUND';
  if (token === 'fetch' || token === 'required') return token;
  return `present (${token.length} chars)`;
}

describe('CSRF Token diagnostics', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;

  beforeAll(async () => {
    try {
      // Already connected. The connector refuses work on a connection nobody
      // opened: when this was missing, every endpoint below answered
      // ADT_NOT_CONNECTED and the diagnostic reported "NO CSRF token from any
      // endpoint" — a connection defect dressed up as a server one.
      connection = await createTestConnection(connectionLogger);
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  // CSRF tokens are an HTTP concept — not applicable over RFC transport
  gateOn(() => getConnectionType() !== 'rfc')(
    'should fetch CSRF token from available endpoints',
    async () => {
      const baseUrl = process.env.SAP_URL!;
      console.log('\n=== CSRF Token Diagnostic ===');
      console.log(`System: ${baseUrl}`);

      const endpoints = ['/sap/bc/adt/core/discovery', '/sap/bc/adt/discovery'];

      // Every endpoint must answer a 2xx carrying a token. A request that
      // throws, a non-2xx, or a token taken from a failed answer fails the
      // test — all of them reported together.
      const failures: string[] = [];

      for (const endpoint of endpoints) {
        console.log(`\n--- Trying: ${endpoint} ---`);
        let response: Awaited<ReturnType<typeof connection.makeAdtRequest>>;
        try {
          response = await connection.makeAdtRequest({
            url: endpoint,
            method: 'GET',
            timeout: 30000,
            headers: {
              'x-csrf-token': 'fetch',
              Accept: 'application/atomsvc+xml',
            },
          });
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : String(error);
          console.log(`  ERROR: ${message}`);
          failures.push(`${endpoint}: the request failed: ${message}`);
          continue;
        }

        const status = response.status;
        const contentType = response.headers?.['content-type'] ?? '';
        const csrfToken = response.headers?.['x-csrf-token'] as
          | string
          | undefined;

        console.log(`  Status: ${status}`);
        console.log(`  Content-Type: ${contentType}`);
        // The value never goes to the log. This diagnostic runs against a real
        // system and its output gets pasted into issues and committed as
        // evidence — which is how live tokens reached a public repository once
        // already. What it needs to report is whether one came back.
        console.log(`  x-csrf-token: ${describeToken(csrfToken)}`);

        if (typeof status !== 'number' || status < 200 || status >= 300) {
          failures.push(`${endpoint}: answered HTTP ${String(status)}`);
        } else if (
          !csrfToken ||
          csrfToken === 'fetch' ||
          csrfToken === 'required'
        ) {
          failures.push(
            `${endpoint}: answered no CSRF token (${describeToken(csrfToken)})`,
          );
        }
      }

      console.log(
        `\n  Result: ${failures.length === 0 ? 'CSRF token from every endpoint' : failures.join('; ')}`,
      );
      console.log('=== End Diagnostic ===\n');

      expect(failures).toEqual([]);
    },
    60000,
  );
});
