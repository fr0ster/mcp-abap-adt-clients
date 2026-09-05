/**
 * Integration test for object version history (getVersions / getVersionSource).
 *
 * Covers the types whose version URL is verified end-to-end on the cloud trial:
 * table, class, interface, serviceDefinition. Other source types build a
 * candidate URL that degrades to UNSUPPORTED_OPERATION where unsupported.
 *
 * Self-skips when no .env / SAP config is present.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  IAbapConnection,
  IAdtResponse,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type { ObjectVersion } from '../../../../core/shared/results';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
  releaseTestConnection,
  skipUnlessConfigured,
} from '../../../helpers/sessionConfig';
import { createTestsLogger } from '../../../helpers/testLogger';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const logger = createTestsLogger();

describe('Object version history', () => {
  let connection: IAbapConnection & ISessionLifecycleAware;
  let client: AdtClient;
  let hasConfig = false;

  beforeAll(async () => {
    try {
      connection = await createTestConnection(logger);
      const { client: c } = await createTestAdtClient(connection, logger);
      client = c;
      hasConfig = true;
    } catch (error) {
      // Skips only when there is no SAP here; anything else fails
      // naming the reason, instead of passing green having run nothing.
      hasConfig = skipUnlessConfigured(error, logger);
    }
  }, 60000);

  afterAll(async () => {
    if (connection) await releaseTestConnection(connection);
  });

  const cases: Array<{
    label: string;
    list: () => Promise<IAdtResponse<ObjectVersion[]>>;
  }> = [
    {
      label: 'table',
      list: () => client.getTable().getVersions({ tableName: 'ZAC_SHR_BTABL' }),
    },
    {
      label: 'class',
      list: () => client.getClass().getVersions({ className: 'ZAC_SHR_DMP01' }),
    },
    {
      label: 'interface',
      list: () =>
        client.getInterface().getVersions({ interfaceName: 'ZAC_SHR_IF01' }),
    },
    {
      label: 'serviceDefinition',
      list: () =>
        client
          .getServiceDefinition()
          .getVersions({ serviceDefinitionName: 'ZAC_SHR_SRVD01' }),
    },
  ];

  for (const tc of cases) {
    it(`lists versions and fetches a version's source for ${tc.label}`, async () => {
      if (!hasConfig) return;
      const versions = expectResult(await tc.list(), `${tc.label} versions`);
      expect(Array.isArray(versions)).toBe(true);
      expect(versions.length).toBeGreaterThan(0);
      const v = versions[0];
      expect(typeof v.versionId).toBe('string');
      expect(typeof v.contentUri).toBe('string');
      expect(v.contentUri.length).toBeGreaterThan(0);

      // getVersionSource is the same opaque-URI fetch on every handler.
      const src = expectResult(
        await client.getTable().getVersionSource(v.contentUri),
        'src',
      );
      expect(typeof src).toBe('string');
      expect(src.length).toBeGreaterThan(0);
    }, 60000);
  }
});
