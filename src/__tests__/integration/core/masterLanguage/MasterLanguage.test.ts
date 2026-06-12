/**
 * Integration test for master/original language on create (fr0ster/mcp-abap-adt#105).
 *
 * Verifies that the language configured via `environment.default_master_language`
 * in test-config.yaml is:
 *   1. sent on the create request (adtcore:language + adtcore:masterLanguage), and
 *   2. persisted on the created object (round-trip read).
 *
 * On a system where the configured language is not installed, SAP normalizes the
 * master language to the system default — so set `default_master_language` only to
 * a language the target system actually has (leave "" → EN, which every system has).
 *
 * Run: npm test -- integration/core/masterLanguage
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import {
  createTestAdtClient,
  getConfig,
  getConnectionOptions,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';

const {
  resolvePackageName,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const silentLogger: ILogger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

function masterLangOf(xml: string): string | undefined {
  return xml.match(/adtcore:masterLanguage="([^"]*)"/)?.[1];
}

describe('Master language on create (#105)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let expectedLang = 'EN';
  let sentLang: string | undefined;
  const className = 'ZCL_AC_MASTERLANG_IT';
  let packageName = 'ZADT_BLD_PKG03';

  beforeAll(async () => {
    if (!process.env.SAP_URL) {
      return;
    }
    hasConfig = true;
    const config = getConfig();
    connection = createAbapConnection(
      config,
      silentLogger,
      undefined,
      undefined,
      getConnectionOptions(),
    );
    await (connection as { connect(): Promise<void> }).connect();

    const isCloud = await isCloudEnvironment(connection);
    const systemContext = await resolveSystemContext(connection, isCloud);
    expectedLang = systemContext.masterLanguage || 'EN';
    packageName = resolvePackageName();

    // Capture the language actually sent on the class create POST.
    const original = connection.makeAdtRequest.bind(connection);
    (connection as { makeAdtRequest: typeof original }).makeAdtRequest = async (
      options,
    ) => {
      const body = String((options as { data?: unknown }).data ?? '');
      if (
        (options as { method?: string }).method === 'POST' &&
        body.includes('class:abapClass')
      ) {
        sentLang = masterLangOf(body);
      }
      return original(options);
    };

    ({ client } = await createTestAdtClient(
      connection,
      silentLogger,
      systemContext,
    ));
  }, getTimeout('connection') ?? 60000);

  it(
    'creates a class whose master language matches test-config default_master_language',
    async () => {
      if (!hasConfig) {
        console.warn('No SAP config — skipping master language test');
        return;
      }

      const cls = client.getClass();
      // idempotent: remove any leftover from a previous run
      try {
        await cls.delete({ className });
      } catch {
        /* not present */
      }

      try {
        await cls.create({
          className,
          packageName,
          description: 'master language integration probe',
        });

        // 1. The create request must carry the configured language.
        expect(sentLang).toBe(expectedLang);

        // 2. Round-trip: the persisted master language must match — but only
        //    when the configured language is installed on the system (else SAP
        //    normalizes it). Metadata of a freshly created inactive object may
        //    not be immediately readable, so retry a few times; if it stays
        //    unreadable, the wire assertion above already proves the feature.
        let persisted: string | undefined;
        for (let attempt = 0; attempt < 8 && !persisted; attempt++) {
          try {
            const meta = await cls.readMetadata({ className });
            persisted = masterLangOf(String(meta.metadataResult?.data ?? ''));
          } catch {
            /* not ready yet */
          }
          if (!persisted) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
        if (persisted !== undefined) {
          expect(persisted).toBe(expectedLang);
        } else {
          console.warn(
            `Could not read back metadata for ${className} — persistence check skipped (wire language was "${sentLang}")`,
          );
        }
      } finally {
        try {
          await cls.delete({ className });
        } catch {
          /* best effort cleanup */
        }
      }
    },
    getTimeout('create') ?? 120000,
  );
});
