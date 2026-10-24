/**
 * The service binding's two reads beyond its lifecycle, through the contract
 * `getServiceBinding()` answers (`IAdtServiceBindingTypes`,
 * `IAdtServiceGroupReadable`, interfaces-adt 13.2.0).
 *
 * Read-only, against the shared binding: no object is created. Measured on
 * premise and on the cloud (2026-10-10): the types come back as a
 * `nameditem:namedItemList`, the group as `odatav4:serviceGroup`.
 *
 * Run: npm test -- src/__tests__/integration/core/serviceBinding/ServiceBindingReads.test.ts
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { IServiceBindingContract } from '../../../../clients/AdtClient';
import type { serviceDocuments } from '../../../../core/service/types';
import { gateOn } from '../../../helpers/caseGate';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import { logTestStep } from '../../../helpers/testProgressLogger';

const { getSharedDependenciesConfig } = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

interface ISharedBinding {
  name: string;
  service_definition?: string;
  service_name?: string;
}

/** The shared binding these cases read, set up by `shared:setup`. */
function sharedBinding(): ISharedBinding | undefined {
  return (getSharedDependenciesConfig()?.service_bindings ?? [])[0];
}

// Service bindings are absent on legacy systems; with no shared binding set up
// there is nothing to read.
const readsBinding = gateOn(({ isLegacy }) => !isLegacy && !!sharedBinding());

describe('Service binding reads (getServiceBinding contract)', () => {
  let connection: IAbapConnection | undefined;
  let bindings: IServiceBindingContract<typeof serviceDocuments>;
  let shared: ISharedBinding | undefined;

  beforeAll(async () => {
    shared = sharedBinding();
    if (!shared) throw new Error('no shared service binding configured');
    try {
      connection = await createTestConnection(connectionLogger);
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
      throw error;
    }
    const { client } = await createTestAdtClient(connection, libraryLogger);
    bindings = client.getServiceBinding();
  });

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  readsBinding('lists the binding types the system offers', async () => {
    const document = String(
      expectResult(
        await bindings.getServiceBindingTypes({ analyse: analyseException }),
        'binding types',
      ),
    );
    const names = [...document.matchAll(/<nameditem:name>([^<]*)</g)].map(
      (m) => m[1],
    );
    logTestStep(
      `binding types: ${[...new Set(names)].join(', ')}`,
      testsLogger,
    );
    expect(names).toContain('ODATA');
  });

  readsBinding(
    'reads the service group the shared binding publishes',
    async () => {
      const binding = shared as ISharedBinding;
      const metadata = String(
        expectResult(
          await bindings.readMetadata(
            { bindingName: binding.name },
            { analyse: analyseException },
          ),
          'binding metadata',
        ),
      );
      const version =
        /srvb:binding[^>]*srvb:version="([^"]*)"/.exec(metadata)?.[1] ?? 'V4';
      const serviceType =
        version.toUpperCase() === 'V2' ? 'odatav2' : 'odatav4';
      const srvd = binding.service_definition ?? binding.name;
      const group = String(
        expectResult(
          await bindings.getServiceGroup(
            {
              objectname: binding.name,
              serviceType,
              servicename: binding.service_name ?? srvd,
              serviceversion: '0001',
              srvdname: srvd,
            },
            { analyse: analyseException },
          ),
          'service group',
        ),
      );
      expect(group).toContain(`${serviceType}:serviceGroup`);
      expect(group).toContain(`adtcore:name="${binding.name}"`);
      expect(/:published="(true|false)"/.test(group)).toBe(true);
    },
  );
});
