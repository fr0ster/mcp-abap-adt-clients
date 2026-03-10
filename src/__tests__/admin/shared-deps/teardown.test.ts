/**
 * Admin script: Teardown ALL shared dependencies from a SAP system.
 *
 * Deletes every object listed in shared_dependencies (test-config.yaml)
 * in reverse dependency order. Idempotent — ignores 404 (already gone).
 *
 * Run:  npm run shared:teardown
 *       SAPNWRFC_HOME=... npm run shared:teardown   (for RFC systems)
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
  resolveTransportRequest,
  resetSharedDependencyCache,
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

/** Try to delete an object; ignore 404 (already gone) */
async function safeDelete(
  label: string,
  deleteFn: () => Promise<void>,
  logger: ILogger,
): Promise<'deleted' | 'not_found' | 'failed'> {
  try {
    await deleteFn();
    logger.info(`Deleted ${label}`);
    return 'deleted';
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes('404') ||
      msg.includes('not found') ||
      msg.includes('does not exist')
    ) {
      logger.info(`${label} — already gone (404)`);
      return 'not_found';
    }
    logger.error(`Failed to delete ${label}: ${msg}`);
    return 'failed';
  }
}

describe('Admin: Teardown shared dependencies', () => {
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
    'should delete all shared dependencies in reverse order',
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

      const transportRequest = resolveTransportRequest(
        sharedConfig.transport_request,
      );

      const results: Array<{
        type: string;
        name: string;
        status: string;
      }> = [];

      // Reverse dependency order: bdefs → access_controls → views → tables → function_groups → programs → package
      // (dependents deleted before their dependencies)

      // 1. Behavior definitions
      const bdefs = sharedConfig.behavior_definitions || [];
      for (const item of bdefs) {
        const status = await safeDelete(
          `behavior_definition ${item.name}`,
          async () => {
            await client.getBehaviorDefinition().delete({
              name: item.name,
              transportRequest,
            });
          },
          testsLogger,
        );
        results.push({ type: 'behavior_definitions', name: item.name, status });
      }

      // 1b. Access controls (before views, since they depend on views)
      const accessControls = sharedConfig.access_controls || [];
      for (const item of accessControls) {
        const status = await safeDelete(
          `access_control ${item.name}`,
          async () => {
            await client.getAccessControl().delete({
              accessControlName: item.name,
              transportRequest,
            });
          },
          testsLogger,
        );
        results.push({ type: 'access_controls', name: item.name, status });
      }

      // 2. Views
      const views = sharedConfig.views || [];
      for (const item of views) {
        const status = await safeDelete(
          `view ${item.name}`,
          async () => {
            await client.getView().delete({
              viewName: item.name,
              transportRequest,
            });
          },
          testsLogger,
        );
        results.push({ type: 'views', name: item.name, status });
      }

      // 3. Tables
      const tables = sharedConfig.tables || [];
      for (const item of tables) {
        const status = await safeDelete(
          `table ${item.name}`,
          async () => {
            await client.getTable().delete({
              tableName: item.name,
              transportRequest,
            });
          },
          testsLogger,
        );
        results.push({ type: 'tables', name: item.name, status });
      }

      // 4. Function groups
      const functionGroups = sharedConfig.function_groups || [];
      for (const item of functionGroups) {
        const status = await safeDelete(
          `function_group ${item.name}`,
          async () => {
            await client.getFunctionGroup().delete({
              functionGroupName: item.name,
              transportRequest,
            });
          },
          testsLogger,
        );
        results.push({ type: 'function_groups', name: item.name, status });
      }

      // 5. Programs
      const programs = sharedConfig.programs || [];
      for (const item of programs) {
        const status = await safeDelete(
          `program ${item.name}`,
          async () => {
            await client.getProgram().delete({
              programName: item.name,
              transportRequest,
            });
          },
          testsLogger,
        );
        results.push({ type: 'programs', name: item.name, status });
      }

      // 6. Package (last — after all contents removed)
      if (sharedConfig.package) {
        const status = await safeDelete(
          `package ${sharedConfig.package}`,
          async () => {
            await client.getPackage().delete({
              packageName: sharedConfig.package,
              transportRequest,
            });
          },
          testsLogger,
        );
        results.push({ type: 'package', name: sharedConfig.package, status });
      }

      // Clear in-memory caches
      resetSharedDependencyCache();

      // Summary
      const deleted = results.filter((r) => r.status === 'deleted');
      const notFound = results.filter((r) => r.status === 'not_found');
      const failed = results.filter((r) => r.status === 'failed');

      testsLogger.info(
        `Teardown complete: ${deleted.length} deleted, ${notFound.length} already gone, ${failed.length} failed`,
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
