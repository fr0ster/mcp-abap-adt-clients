/**
 * `getObjectProperties`, against a real system — read only.
 *
 * Asks for the properties of transaction SE38 by its workbench uri, the uri a
 * transaction answers to (`/sap/bc/adt/transactions/{name}` is refused with
 * `422`). SE38 ships with every system, so nothing is configured and nothing
 * is created.
 *
 * Runs where SAP is configured; skips with the reason elsewhere.
 *
 * Enable debug logs: DEBUG_ADT_TESTS=true npm test -- integration/shared/objectProperties
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  IAdtWireResponse,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { utilDocuments } from '../../../core/shared/utilResultSet';
import { wireItself } from '../../../utils/resultStrategy';
import { gateOn } from '../../helpers/caseGate';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { createTestsLogger } from '../../helpers/testLogger';
import { logTestStep } from '../../helpers/testProgressLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

const SE38 = '/sap/bc/adt/vit/wb/object_type/trant/object_name/SE38';

describe('Shared - getObjectProperties', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(testsLogger);
      const { client: resolved } = await createTestAdtClient(
        connection,
        testsLogger,
      );
      client = resolved;
    } catch (error) {
      skipUnlessConfigured(error, testsLogger);
    }
  }, 120000);

  afterAll(async () => {
    if (connection) {
      await releaseTestConnection(connection);
    }
  });

  // Applies wherever SAP is configured.
  gateOn(() => true)(
    'reads the properties of transaction SE38',
    async () => {
      logTestStep(`object properties of ${SE38}`, testsLogger);

      // The exchange itself, so the status is there to assert.
      const answer = await client
        .getUtils({ ...utilDocuments, objectProperties: wireItself })
        .getObjectProperties(SE38, { analyse: analyseException });

      expect(answer.ok).toBe(true);
      if (!answer.ok) {
        throw new Error(`expected a result: ${answer.getError().message}`);
      }
      const wire: IAdtWireResponse = answer.getResult().value;
      expect(wire.status).toBe(200);
      const body = String(wire.data);
      expect(body).toContain('type="TRAN/T"');
      expect(body).toContain('name="SE38"');
    },
    60000,
  );
});
