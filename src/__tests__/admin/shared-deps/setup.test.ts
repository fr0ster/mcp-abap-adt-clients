/**
 * Admin script: Setup ALL shared dependencies on a SAP system.
 *
 * Creates every object listed in shared_dependencies (test-config.yaml)
 * in dependency order. Idempotent — skips objects that already exist.
 *
 * Run:  npm run shared:setup
 *       SAPNWRFC_HOME=... npm run shared:setup   (for RFC systems)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
} from '../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../helpers/testLogger';

const {
  getSharedDependenciesConfig,
  ensureSharedPackage,
  ensureSharedDependency,
  getTimeout,
} = require('../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

describe('Admin: Setup shared dependencies', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      const isCloud = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(connection, isCloud);
      const { client: resolvedClient } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
      hasConfig = true;
    } catch (_error) {
      testsLogger.warn('Skipping: No .env file or SAP configuration found');
      hasConfig = false;
    }
  });

  afterAll(async () => {
    if (connection) {
      (connection as any).reset();
    }
  });

  it(
    'should create all shared dependencies in order',
    async () => {
      if (!hasConfig) {
        testsLogger.warn('Skipping: SAP not configured');
        return;
      }

      const sharedConfig = getSharedDependenciesConfig();
      if (!sharedConfig) {
        testsLogger.warn('Skipping: No shared_dependencies in config');
        return;
      }

      // 1. Package
      testsLogger.info('Setting up shared package...');
      await ensureSharedPackage(client, testsLogger);

      // Dependency order: tables → views → behavior_definitions → function_groups → programs
      const typeOrder: Array<{ type: string; label: string }> = [
        { type: 'tables', label: 'Tables' },
        { type: 'views', label: 'Views' },
        { type: 'behavior_definitions', label: 'Behavior definitions' },
        { type: 'function_groups', label: 'Function groups' },
        { type: 'programs', label: 'Programs' },
      ];

      const results: Array<{
        type: string;
        name: string;
        status: string;
      }> = [];

      for (const { type, label } of typeOrder) {
        const items = sharedConfig[type];
        if (!Array.isArray(items) || items.length === 0) {
          testsLogger.info(`No ${label} defined — skipping`);
          continue;
        }

        testsLogger.info(`Setting up ${label} (${items.length})...`);

        for (const item of items) {
          try {
            const result = await ensureSharedDependency(
              client,
              type,
              item.name,
              testsLogger,
            );
            results.push({
              type,
              name: item.name,
              status: result.created ? 'created' : 'existed',
            });
          } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            testsLogger.error(`Failed to ensure ${type} ${item.name}: ${msg}`);
            results.push({ type, name: item.name, status: `FAILED: ${msg}` });
          }
        }
      }

      // Summary
      const created = results.filter((r) => r.status === 'created');
      const existed = results.filter((r) => r.status === 'existed');
      const failed = results.filter((r) => r.status.startsWith('FAILED'));

      testsLogger.info(
        `Setup complete: ${created.length} created, ${existed.length} already existed, ${failed.length} failed`,
      );

      if (failed.length > 0) {
        for (const f of failed) {
          testsLogger.error(`  ${f.type}:${f.name} — ${f.status}`);
        }
      }

      expect(failed.length).toBe(0);
    },
    getTimeout('long'),
  );
});
