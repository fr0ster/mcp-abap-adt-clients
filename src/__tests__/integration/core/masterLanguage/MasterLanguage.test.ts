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
import { analyseDeletion } from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
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
  resolveTransportRequest,
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
  let transportRequest = '';

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
    transportRequest = resolveTransportRequest(undefined);

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

      // **Every answer is read.** The delete, the create and the cleanup used
      // to be awaited and dropped. On E19 a create without a transport made
      // SAP generate a request of its own (E19K907127, 2026-09-21) and record
      // the class there; from then on every delete was refused with
      // CTS_WBO_API 019 "already locked in request", every create answered
      // "already exists", and the test passed on the leftover for five days
      // without creating anything. It surfaced only when an enqueue lock on
      // that leftover made the activation fail.
      const deleteClass = async (what: string) =>
        expectResult(
          await cls.delete(
            { className, transportRequest },
            { analyse: analyseDeletion },
          ),
          what,
        );

      // Idempotent: remove a leftover from a run that died before cleanup.
      const existing = await cls.readMetadata({ className });
      if (existing.ok) {
        await deleteClass('delete leftover');
      } else if (existing.getError().response?.status !== 404) {
        expectResult(existing, 'look for a leftover');
      }

      let bodyPassed = false;
      try {
        expectResult(
          await cls.create({
            className,
            packageName,
            transportRequest,
            description: 'master language integration probe',
          }),
          'create',
        );

        // 1. The create request must carry the configured language.
        expect(sentLang).toBe(expectedLang);

        // 2. Round-trip: the persisted master language must match — but only
        //    when the configured language is installed on the system (else SAP
        //    normalizes it).
        //
        //    **Give it a version first.** This used to retry the read eight
        //    times over sixteen seconds, believing a freshly created object was
        //    "not immediately readable". It is not a timing problem. A bare
        //    POST makes a repository entry with no version of anything in it —
        //    no source, no active version, no inactive one — and a read of that
        //    refuses with `400 ExceptionResourceWrongData`, "Resource  ZAC_…:
        //    wrong input data for processing", however the version is asked
        //    for. A version is what makes it readable, and either one will do:
        //    writing the source is enough (a class reads at
        //    `version=inactive` while still under its lock), and activating the
        //    empty shell works too. This test has no source to write, so it
        //    activates.
        //
        //    So all eight attempts failed on every run, this assertion never
        //    ran, and the run paid sixteen seconds for the privilege.
        expectResult(await cls.activate({ className }), 'activate');

        const meta = expectResult(
          await cls.readMetadata({ className }),
          'meta',
        );
        const persisted = masterLangOf(String(meta ?? ''));
        expect(persisted).toBe(expectedLang);
        bodyPassed = true;
      } finally {
        // A cleanup that fails is a red test — the leftover is what broke this
        // test before. When the body already failed, its error is the one to
        // report, so the cleanup's must not replace it.
        if (bodyPassed) {
          await deleteClass('cleanup delete');
        } else {
          await cls
            .delete(
              { className, transportRequest },
              { analyse: analyseDeletion },
            )
            .catch(() => undefined);
        }
      }
    },
    getTimeout('create') ?? 120000,
  );
});
