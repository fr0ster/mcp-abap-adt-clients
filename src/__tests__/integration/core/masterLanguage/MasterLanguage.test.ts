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
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { expectResult } from '../../../helpers/contract';
import {
  createTestAdtClient,
  createTestConnection,
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
    connection = await createTestConnection(silentLogger);

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
        //    normalizes it).
        //
        //    **Activate first.** This used to retry the read eight times over
        //    sixteen seconds, believing a freshly created object was "not
        //    immediately readable". It is not a timing problem: measured on a
        //    live system, a class that exists only as an inactive version
        //    refuses every read — metadata with no version, with
        //    `version=inactive`, with `version=active`, and `source/main` too —
        //    all with `400 ExceptionResourceWrongData`, "Resource  ZAC_…:
        //    wrong input data for processing". Activation is what makes it
        //    readable, and the same read answers 8 KB straight after.
        //
        //    So all eight attempts failed on every run, this assertion never
        //    ran, and the run paid sixteen seconds for the privilege.
        const activated = await cls.activate({ className });
        expect(activated.ok).toBe(true);

        const meta = expectResult(
          await cls.readMetadata({ className }),
          'meta',
        );
        const persisted = masterLangOf(String(meta ?? ''));
        expect(persisted).toBe(expectedLang);
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
