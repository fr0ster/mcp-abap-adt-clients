/**
 * Integration test for master/original language on create (fr0ster/mcp-abap-adt#105).
 *
 * Two cases, following the library: a create names a language only when one
 * is configured (`createLanguage` answers `undefined` for none, and
 * `languageAttributes` then writes nothing — by design since 2026-11-04).
 *   1. Without a configured language the create body carries neither
 *      `adtcore:masterLanguage` nor `adtcore:language` (runs everywhere: the
 *      client is built with no language).
 *   2. With `environment.default_master_language` configured the body carries
 *      it and the created object keeps it (round-trip read). Registered as
 *      skipped, saying so, where no language is configured.
 *
 * On a system where the configured language is not installed, SAP normalizes the
 * master language to the system default — so set `default_master_language` only to
 * a language the target system actually has.
 *
 * Run: npm test -- integration/core/masterLanguage
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  analyseActivation,
  analyseDeletion,
  analyseException,
} from '@mcp-abap-adt/adt-strategies';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { integrationHeadersOf } from '../../../helpers/adtHeaders';
import { gateOn } from '../../../helpers/caseGate';
import { expectResult, noteCleanupRefusal } from '../../../helpers/contract';
import { judged } from '../../../helpers/judged';
import {
  createTestAdtClient,
  createTestConnection,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';

const {
  getEnvironmentConfig,
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

function languageOf(xml: string): string | undefined {
  return xml.match(/adtcore:language="([^"]*)"/)?.[1];
}

/** The language the configuration states for created objects, if any. */
function configuredLanguage(): string | undefined {
  try {
    return getEnvironmentConfig()?.default_master_language || undefined;
  } catch {
    // No configuration here: the gate below registers nothing that runs.
    return undefined;
  }
}

describe('Master language on create (#105)', () => {
  let connection: IAbapConnection;
  let systemContext: Awaited<ReturnType<typeof resolveSystemContext>>;
  let sentBody: string | undefined;
  const className = 'ZCL_AC_MASTERLANG_IT';
  let packageName = 'ZADT_BLD_PKG03';
  let transportRequest = '';
  const configured = configuredLanguage();

  beforeAll(async () => {
    if (!process.env.SAP_URL) {
      return;
    }
    connection = await createTestConnection(silentLogger);

    const isCloud = await isCloudEnvironment(connection);
    systemContext = await resolveSystemContext(connection, isCloud);
    packageName = resolvePackageName();
    transportRequest = resolveTransportRequest(undefined);

    // Capture the body actually sent on the class create POST.
    const original = connection.makeAdtRequest.bind(connection);
    (connection as { makeAdtRequest: typeof original }).makeAdtRequest = async (
      options,
    ) => {
      const body = String((options as { data?: unknown }).data ?? '');
      if (
        (options as { method?: string }).method === 'POST' &&
        body.includes('class:abapClass')
      ) {
        sentBody = body;
      }
      return original(options);
    };
  }, getTimeout('connection') ?? 60000);

  /**
   * Create the probe class through a client of `context`, run `check` on what
   * was sent and stored, and delete the class — every answer read.
   *
   * **Every answer is read.** The delete, the create and the cleanup used to
   * be awaited and dropped. On premise (BASIS 816) a create without a
   * transport made SAP generate a request of its own and record the class
   * there; from then on every delete was refused with CTS_WBO_API 019
   * "already locked in request", every create answered "already exists", and
   * the test passed on the leftover for five days without creating anything.
   */
  async function withProbeClass(
    context: Awaited<ReturnType<typeof resolveSystemContext>>,
    check: (cls: ReturnType<AdtClient['getClass']>) => Promise<void>,
  ): Promise<void> {
    const { client } = await createTestAdtClient(
      connection,
      silentLogger,
      context,
    );
    const cls = client.getClass();
    const deleteClass = async (what: string) =>
      expectResult(
        await cls.delete(
          { className, transportRequest },
          {
            headers: integrationHeadersOf(cls, 'delete'),
            analyse: judged(analyseDeletion),
          },
        ),
        what,
      );

    // Idempotent: remove a leftover from a run that died before cleanup.
    const existing = await cls.readMetadata(
      { className },
      { analyse: analyseException },
    );
    if (existing.ok) {
      await deleteClass('delete leftover');
    } else if (existing.getError().response?.status !== 404) {
      expectResult(existing, 'look for a leftover');
    }

    sentBody = undefined;
    let bodyPassed = false;
    try {
      expectResult(
        await cls.create(
          {
            className,
            packageName,
            transportRequest,
            description: 'master language integration probe',
          },
          {
            analyse: analyseException,
            headers: integrationHeadersOf(cls, 'create'),
          },
        ),
        'create',
      );
      await check(cls);
      bodyPassed = true;
    } catch (error) {
      // The body failed: its error is the one to report. A refused cleanup
      // is added to it rather than dropped, and does not replace it.
      await noteCleanupRefusal(
        error,
        () =>
          cls.delete(
            { className, transportRequest },
            {
              headers: integrationHeadersOf(cls, 'delete'),
              analyse: judged(analyseDeletion),
            },
          ),
        'cleanup delete',
      );
      throw error;
    } finally {
      // A cleanup that fails is a red test — the leftover is what broke this
      // test before.
      if (bodyPassed) {
        await deleteClass('cleanup delete');
      }
    }
  }

  gateOn(() => true)(
    'creates a class with no language named when none is configured',
    async () => {
      await withProbeClass(
        { ...systemContext, masterLanguage: undefined },
        async () => {
          const sent = sentBody ?? '';
          expect(sent).toContain('class:abapClass');
          expect(masterLangOf(sent)).toBeUndefined();
          expect(languageOf(sent)).toBeUndefined();
        },
      );
    },
    getTimeout('create') ?? 120000,
  );

  gateOn(() => configured !== undefined)(
    configured === undefined
      ? 'creates a class in the configured master language — skipped: no environment.default_master_language is configured for this system'
      : `creates a class in the configured master language (${configured})`,
    async () => {
      await withProbeClass(systemContext, async (cls) => {
        const sent = sentBody ?? '';
        // 1. The create request carries the configured language.
        expect(masterLangOf(sent)).toBe(configured);
        expect(languageOf(sent)).toBe(configured);

        // 2. Round-trip: the persisted master language matches. A bare POST
        //    makes a repository entry with no version of anything in it, and
        //    a read of that refuses with `400 ExceptionResourceWrongData`; a
        //    version is what makes it readable, and activating the empty
        //    shell gives it one.
        expectResult(
          await cls.activate(
            { className },
            {
              analyse: judged(analyseActivation),
              headers: integrationHeadersOf(cls, 'activate'),
            },
          ),
          'activate',
        );
        const meta = expectResult(
          await cls.readMetadata({ className }, { analyse: analyseException }),
          'meta',
        );
        expect(masterLangOf(String(meta ?? ''))).toBe(configured);
      });
    },
    getTimeout('create') ?? 120000,
  );
});
