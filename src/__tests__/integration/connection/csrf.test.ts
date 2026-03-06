/**
 * CSRF Token diagnostics test
 *
 * Tests CSRF token fetch behavior and logs full request/response headers
 * for debugging connection issues across different SAP systems.
 *
 * Checks multiple endpoints:
 * - /sap/bc/adt/core/discovery (used by connection package)
 * - /sap/bc/adt/discovery (fallback for older systems)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import axios from 'axios';
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

/**
 * Fetch CSRF token from a given endpoint and log full request/response details
 */
async function fetchCsrfFromEndpoint(
  endpointUrl: string,
  requestHeaders: Record<string, string>,
): Promise<string | undefined> {
  console.log(`\n--- Trying: ${endpointUrl} ---`);

  const response = await axios({
    method: 'GET',
    url: endpointUrl,
    headers: requestHeaders,
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  console.log(`  Status: ${response.status} ${response.statusText}`);
  console.log(`  Content-Type: ${response.headers['content-type']}`);
  console.log(`  Content-Length: ${response.headers['content-length']}`);

  const csrfToken = response.headers['x-csrf-token'];
  console.log(`  x-csrf-token: ${csrfToken || 'NOT FOUND'}`);

  if (response.headers['set-cookie']) {
    const cookies = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie']
      : [response.headers['set-cookie']];
    console.log(`  Cookies (${cookies.length}):`);
    for (const cookie of cookies) {
      // Show only cookie name=first30chars
      const name = cookie.split('=')[0];
      const value = cookie.substring(name.length + 1, name.length + 31);
      console.log(`    ${name}=${value}...`);
    }
  }

  if (typeof response.data === 'string' && response.data.length > 0) {
    console.log(
      `  Body (${response.data.length} chars): ${response.data.substring(0, 200)}`,
    );
  } else {
    console.log('  Body: empty');
  }

  // Log ALL response headers for full diagnostics
  console.log('  All response headers:');
  for (const [key, value] of Object.entries(response.headers)) {
    if (key === 'set-cookie') continue; // already logged
    console.log(`    ${key}: ${value}`);
  }

  return csrfToken || undefined;
}

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

    const baseUrl = process.env.SAP_URL!;
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    const client = process.env.SAP_CLIENT;

    console.log('\n=== CSRF Token Diagnostic ===');
    console.log(`System: ${baseUrl}`);
    console.log(`Client: ${client}, User: ${username}`);

    const requestHeaders: Record<string, string> = {
      'x-csrf-token': 'fetch',
      Accept: 'application/atomsvc+xml',
    };
    if (username && password) {
      requestHeaders.Authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
    }
    if (client) {
      requestHeaders['X-SAP-Client'] = client;
    }

    // Test both endpoints
    const endpoints = [
      `${baseUrl}/sap/bc/adt/core/discovery`,
      `${baseUrl}/sap/bc/adt/discovery`,
    ];

    const results: Record<string, string | undefined> = {};

    for (const endpoint of endpoints) {
      try {
        results[endpoint] = await fetchCsrfFromEndpoint(
          endpoint,
          requestHeaders,
        );
      } catch (error: any) {
        console.log(`\n--- ${endpoint} ERROR ---`);
        console.log(`  ${error.message}`);
        if (error.response) {
          console.log(`  Status: ${error.response.status}`);
        }
      }
    }

    // Summary
    console.log('\n=== Summary ===');
    for (const [endpoint, token] of Object.entries(results)) {
      const path = endpoint.replace(baseUrl, '');
      console.log(`  ${path}: ${token ? `OK (${token.substring(0, 20)}...)` : 'FAILED'}`);
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
