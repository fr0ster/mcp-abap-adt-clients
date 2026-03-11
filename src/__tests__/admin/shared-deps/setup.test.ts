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
  let envType = 'onprem';

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      const isCloud = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(connection, isCloud);
      const { client: resolvedClient, isLegacy } = await createTestAdtClient(
        connection,
        libraryLogger,
        systemContext,
      );
      client = resolvedClient;
      envType = isCloud ? 'cloud' : isLegacy ? 'legacy' : 'onprem';
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

      // Dependency order: tables → views → access_controls → behavior_definitions → service_definitions → service_bindings → classes → interfaces → function_groups → function_modules → programs
      const typeOrder: Array<{ type: string; label: string }> = [
        { type: 'tables', label: 'Tables' },
        { type: 'views', label: 'Views' },
        { type: 'access_controls', label: 'Access controls' },
        { type: 'behavior_definitions', label: 'Behavior definitions' },
        { type: 'service_definitions', label: 'Service definitions' },
        { type: 'service_bindings', label: 'Service bindings' },
        { type: 'classes', label: 'Classes' },
        { type: 'interfaces', label: 'Interfaces' },
        { type: 'function_groups', label: 'Function groups' },
        { type: 'function_modules', label: 'Function modules' },
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
          if (item.available_in && !item.available_in.includes(envType)) {
            testsLogger.info(
              `Skipping ${type} ${item.name} — not available in ${envType}`,
            );
            results.push({ type, name: item.name, status: 'skipped' });
            continue;
          }
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

      // Group activation for objects with skip_activation: true
      const adtTypeMap: Record<string, string> = {
        service_definitions: 'SRVD/SRV',
        service_bindings: 'SRVB/SVB',
      };

      const groupActivationObjects: Array<{
        type: string;
        name: string;
      }> = [];
      for (const { type } of typeOrder) {
        const items = sharedConfig[type];
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          if (!item.skip_activation) continue;
          if (item.available_in && !item.available_in.includes(envType))
            continue;
          const adtType = adtTypeMap[type];
          if (!adtType) continue;
          // Only activate if not failed
          const resultEntry = results.find(
            (r) => r.type === type && r.name === item.name,
          );
          if (resultEntry?.status.startsWith('FAILED')) continue;
          groupActivationObjects.push({ type: adtType, name: item.name });
        }
      }

      if (groupActivationObjects.length > 0) {
        testsLogger.info(
          `Group activating ${groupActivationObjects.length} objects: ${groupActivationObjects.map((o) => `${o.type}:${o.name}`).join(', ')}`,
        );
        try {
          await client.getUtils().activateObjectsGroup(groupActivationObjects);
          testsLogger.info('Group activation completed successfully');
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          testsLogger.error(`Group activation failed: ${msg}`);
          results.push({
            type: 'group_activation',
            name: groupActivationObjects.map((o) => o.name).join('+'),
            status: `FAILED: ${msg}`,
          });
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
