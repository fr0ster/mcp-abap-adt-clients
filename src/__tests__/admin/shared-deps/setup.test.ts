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
import type {
  IAbapConnection,
  ILogger,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../utils/systemInfo';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  resolveSystemContext,
  skipUnlessConfigured,
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
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;
  let envType = 'onprem';

  beforeAll(async () => {
    try {
      connection = await createTestConnection(connectionLogger);
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
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails naming the
      // reason. This one builds the shared dependency library — a silent skip
      // here leaves every test that borrows from it to fail later, elsewhere.
      hasConfig = skipUnlessConfigured(error, testsLogger);
    }
  });

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  /**
   * A dropped connection says nothing about the object.
   *
   * Measured against the BTP trial: `ECONNRESET` and `timeout of 45000ms
   * exceeded` accounted for every failure in a run where the logic was
   * otherwise correct — the same objects that failed one run succeeded in the
   * next. One aborted socket used to end that dependency for the whole run, and
   * everything downstream of it failed for a reason that was never about it.
   *
   * Only transport aborts are retried. A 400, an activation error, a lock
   * refusal — anything the server actually said — is an answer, and repeating a
   * request the server answered would only get the same answer more slowly.
   */
  const TRANSPORT_ABORT =
    /ECONNRESET|ECONNABORTED|ETIMEDOUT|EPIPE|socket hang up|timeout of \d+ms exceeded|network socket disconnected/i;

  async function ensureWithTransportRetry<T>(
    type: string,
    name: string,
    attempt: () => Promise<T>,
  ): Promise<T> {
    const MAX_ATTEMPTS = 3;
    let last: unknown;
    for (let n = 1; n <= MAX_ATTEMPTS; n++) {
      try {
        return await attempt();
      } catch (error) {
        last = error;
        const msg = error instanceof Error ? error.message : String(error);
        if (!TRANSPORT_ABORT.test(msg) || n === MAX_ATTEMPTS) break;
        testsLogger.warn(
          `${type} ${name}: transport aborted (${msg}) — attempt ${n} of ${MAX_ATTEMPTS}, retrying`,
        );
      }
    }
    throw last;
  }

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
        // Structures first: a table may include one, and nothing else here
        // depends on a table existing before a structure does.
        // Domains first, then data elements that reference them, then anything
        // built on top: the chain is created in dependency order and torn down
        // in reverse.
        { type: 'domains', label: 'Domains' },
        { type: 'data_elements', label: 'Data elements' },
        { type: 'structures', label: 'Structures' },
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
            // Named, because `ensureSharedDependency` arrives through
            // `require()` and is therefore `any` — without this the generic
            // infers `unknown` and `result.created` does not compile.
            const result = await ensureWithTransportRetry<{
              created: boolean;
              existed: boolean;
            }>(type, item.name, () =>
              ensureSharedDependency(client, type, item.name, testsLogger),
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

      // Nothing may be left inactive either. Every branch above asks for
      // activation, but asking is not the same as it having happened: an
      // activation that reports no error still leaves the object inactive when
      // the server did no work (`activationExecuted=false`), and the objects
      // deferred to group activation are activated by a single later call whose
      // effect nothing here checked. So the state is read back from the system
      // that holds it.
      const configured = new Set(
        results
          .filter((r) => r.status === 'created' || r.status === 'existed')
          .map((r) => r.name.toUpperCase()),
      );

      // Ask the system what it still calls inactive, activate exactly that, and
      // ask again.
      //
      // The list above activates the objects a human predicted would need it —
      // `skip_activation: true`, mapped by type. Measured on the trial, that
      // list was incomplete in a way nobody could see: `ZAC_SHR_FUGR` has no
      // `source`, so the "already exists" path did nothing with it and never
      // activated it, and `Z_AC_SHR_FM01` reported "updated and activated" on
      // every run while remaining inactive — a function module cannot be active
      // while its group is not. Both had been inactive the whole time.
      //
      // So the closing step is not a prediction. It reads the state from the
      // system that holds it and acts on what it finds, whatever the type.
      const ours = (list: { name?: string }[]) =>
        list.filter((o) => configured.has(String(o.name).toUpperCase()));

      const firstPass = ours(
        (await client.getUtils().getInactiveObjects()).objects,
      ) as Array<{ name: string; type: string }>;
      if (firstPass.length > 0) {
        testsLogger.info(
          `Still inactive, activating: ${firstPass.map((o) => `${o.type}:${o.name}`).join(', ')}`,
        );
        try {
          await client
            .getUtils()
            .activateObjectsGroup(
              firstPass.map((o) => ({ type: o.type, name: o.name })),
            );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          testsLogger.error(`Closing activation failed: ${msg}`);
          results.push({
            type: 'closing_activation',
            name: firstPass.map((o) => o.name).join('+'),
            status: `FAILED: ${msg}`,
          });
        }
      }

      const inactive = await client.getUtils().getInactiveObjects();
      const stillInactive = ours(inactive.objects).map(
        (o) => `inactive ${(o as { type: string }).type}:${o.name}`,
      );
      testsLogger.info(
        `Inactive after setup: ${stillInactive.length === 0 ? 'none' : stillInactive.join(', ')}`,
      );

      // Written to a file, not only logged. `forceExit: true` kills the process
      // as soon as the last assertion settles, and the trailing log lines go
      // with it — the first clean run printed "Setup complete" and then nothing,
      // so the one line proving the activation check had run was exactly the one
      // that vanished. A green test with no evidence is a green test you have to
      // take on trust.
      fs.writeFileSync(
        path.resolve(__dirname, '../../../../shared-setup-verdict.json'),
        `${JSON.stringify(
          {
            checkedAt: new Date().toISOString(),
            objectsConsidered: [...configured].sort(),
            inactiveReportedBySystem: inactive.objects.length,
            ofOursStillInactive: stillInactive,
            failed: failed.map((f) => `${f.type}:${f.name} — ${f.status}`),
          },
          null,
          2,
        )}\n`,
      );

      // One verdict, carrying both questions and the names that answer them.
      //
      // Two things were wrong with reporting these separately. The count said
      // "Expected: 0, Received: 2" and nothing else — the names went to a logger
      // silent unless DEBUG_ADT_TESTS=true, so a forty-minute run did not say
      // what had failed. And asserting the failures first meant the activation
      // check never ran on any run that had one, which is exactly the run whose
      // activation state is worth knowing.
      expect([
        ...failed.map((f) => `${f.type}:${f.name} — ${f.status}`),
        ...stillInactive,
      ]).toStrictEqual([]);
    },
    getTimeout('shared_admin'),
  );
});
