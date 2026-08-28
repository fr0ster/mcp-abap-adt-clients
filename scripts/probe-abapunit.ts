/**
 * ABAP Unit probe — is `POST /abapunit/testruns` synchronous, and what decides it?
 *
 * Issue #115, steps 5 and 6. Two questions, one trip:
 *
 *  1. **Synchronous or not.** The closed PR behind #112 claims the endpoint
 *     answers with the finished result. `AdtUnitTestLegacy` already owns the
 *     same URL and treats it as async. Both cannot be right about one URL on
 *     one system. What decides it is the **root element of the response body**
 *     and whether a `Location` header is present — not the status code, which
 *     is `200` either way.
 *  2. **What switches the behaviour** — the URL or the media type. The same
 *     POST goes out twice: once with the v4 config / v2 result types the sync
 *     claim names, once with `application/xml` both ways, which is what the
 *     legacy path sends. A difference means the media type is the switch, as
 *     it turned out to be for ATC.
 *
 * Step 6 rides along: the two `<alert>` elements a failing assertion and an
 * uncaught exception produce are in the recorded body verbatim, `kind` and
 * `severity` intact, so the classification question is answered by reading the
 * evidence rather than by re-running anything.
 *
 * Nothing is interpreted. Every response is written whole, headers included,
 * whichever way it goes — a 406 for the v4 types would itself be the answer.
 *
 * Usage:
 *   npx ts-node scripts/probe-abapunit.ts --class=ZAC_UTST_CLS
 *   MCP_ENV_PATH=./e77.env npx ts-node scripts/probe-abapunit.ts --class=ZAC_UTST_CLS
 *
 * Flags:
 *   --class=NAME  the class carrying the tests. It must already exist with its
 *                 test include intact — this probe creates nothing, because an
 *                 object it invented would not be the one the suite runs.
 *   --out=DIR     where to write the evidence (default: abapunit-probe/)
 *
 * Exit code is 1 only when the probe itself could not ask. A `406`, a
 * `Location`, an async-looking body: all results, all exit 0.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ILogger } from '@mcp-abap-adt/interfaces';
import { DefaultLogger } from '@mcp-abap-adt/logger';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  getConfig,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const TESTRUNS_URL = '/sap/bc/adt/abapunit/testruns';
const TIMEOUT = 120_000;

/** The media-type pair the sync claim names. */
const V4 = {
  label: 'v4-typed',
  contentType: 'application/vnd.sap.adt.abapunit.testruns.config.v4+xml',
  accept: 'application/vnd.sap.adt.abapunit.testruns.result.v2+xml',
  answers:
    'Does the typed pair answer with a finished result, and without a Location?',
};

/** What `AdtUnitTestLegacy` sends to the same URL. */
const GENERIC = {
  label: 'generic-xml',
  contentType: 'application/xml',
  accept: 'application/xml',
  answers:
    'Same URL, legacy media types. A different answer means the type is the switch, not the URL.',
};

function runConfiguration(classUri: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<aunit:runConfiguration xmlns:aunit="http://www.sap.com/adt/aunit">' +
    '<external><coverage active="false"/></external>' +
    '<options>' +
    '<uriType value="semantic"/>' +
    '<testDeterminationStrategy sameProgram="true" assignedTests="false"/>' +
    '<testRiskLevels harmless="true" dangerous="true" critical="true"/>' +
    '<testDurations short="true" medium="true" long="true"/>' +
    '<withNavigationUri enabled="true"/>' +
    '</options>' +
    '<adtcore:objectSets xmlns:adtcore="http://www.sap.com/adt/core">' +
    '<objectSet kind="inclusive">' +
    '<adtcore:objectReferences>' +
    `<adtcore:objectReference adtcore:uri="${classUri}"/>` +
    '</adtcore:objectReferences>' +
    '</objectSet>' +
    '</adtcore:objectSets>' +
    '</aunit:runConfiguration>'
  );
}

/**
 * The first element name in the body. Mechanical, not a classification: which
 * root came back is exactly what step 5 asks, and reading it here saves nobody
 * from reading the file — the file is written whole either way.
 */
function rootElement(body: string): string | null {
  const match = body.match(/<\s*([A-Za-z_][\w.:-]*)/);
  return match ? match[1] : null;
}

interface IStep {
  n: number;
  label: string;
  answers: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body: string;
  };
  status: number | null;
  statusText?: string;
  durationMs: number;
  responseHeaders?: Record<string, unknown>;
  /** Half the answer to step 5, so it is lifted out of the header bag. */
  location?: string | null;
  rootElement?: string | null;
  bodyFile?: string;
  bodyPreview?: string;
  error?: string;
}

function parseArgs(argv: string[]): { className?: string; out: string } {
  let className: string | undefined;
  let out = 'abapunit-probe';
  for (const arg of argv) {
    if (arg.startsWith('--class=')) className = arg.slice('--class='.length);
    else if (arg.startsWith('--out=')) out = arg.slice('--out='.length);
  }
  return { className, out };
}

async function main(): Promise<void> {
  const logger: ILogger = new DefaultLogger();
  const args = parseArgs(process.argv.slice(2));
  if (!args.className) {
    logger.error(
      '--class=NAME is required. The class must already carry its tests: this probe creates nothing.',
    );
    process.exitCode = 1;
    return;
  }
  const classUri = `/sap/bc/adt/oo/classes/${args.className}`;
  const xml = runConfiguration(classUri);

  const outDir = path.resolve(process.cwd(), args.out);
  fs.mkdirSync(outDir, { recursive: true });

  const sapConfig = getConfig();
  const connection = await createTestConnection(createConnectionLogger());
  await connection.connect();
  logger.info(`Connected to ${sapConfig.url}; object set is ${classUri}`);

  const steps: IStep[] = [];
  let n = 0;

  for (const variant of [V4, GENERIC]) {
    n += 1;
    const headers = {
      'Content-Type': variant.contentType,
      Accept: variant.accept,
    };
    const record: IStep = {
      n,
      label: variant.label,
      answers: variant.answers,
      request: { method: 'POST', url: TESTRUNS_URL, headers, body: xml },
      status: null,
      durationMs: 0,
    };
    logger.info(
      `[${n}] ${variant.label} — POST ${TESTRUNS_URL} (${variant.contentType})`,
    );

    const startedAt = Date.now();
    let body = '';
    let responseHeaders: Record<string, unknown> = {};
    try {
      const response = await connection.makeAdtRequest({
        url: TESTRUNS_URL,
        method: 'POST',
        timeout: TIMEOUT,
        data: xml,
        headers,
      });
      record.status = response.status;
      record.statusText = response.statusText;
      responseHeaders = (response.headers ?? {}) as Record<string, unknown>;
      body =
        typeof response.data === 'string'
          ? response.data
          : String(response.data ?? '');
    } catch (error: unknown) {
      const e = error as {
        message?: string;
        response?: {
          status?: number;
          statusText?: string;
          headers?: Record<string, unknown>;
          data?: unknown;
        };
      };
      record.status = e.response?.status ?? null;
      record.statusText = e.response?.statusText;
      responseHeaders = e.response?.headers ?? {};
      record.error = e.message ?? String(error);
      const data = e.response?.data;
      body = typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
      logger.warn(
        `[${n}] ${variant.label} → ${record.status ?? 'no status'}: ${record.error}`,
      );
    }

    record.durationMs = Date.now() - startedAt;
    record.responseHeaders = responseHeaders;
    record.location =
      (responseHeaders.location as string | undefined) ??
      (responseHeaders.Location as string | undefined) ??
      null;
    record.rootElement = rootElement(body);

    const file = `${String(n).padStart(2, '0')}-${variant.label}.xml`;
    fs.writeFileSync(path.join(outDir, file), body, 'utf8');
    record.bodyFile = file;
    record.bodyPreview = body.slice(0, 400);
    steps.push(record);

    logger.info(
      `[${n}] → ${record.status ?? 'no status'}, ${body.length} bytes, ${record.durationMs}ms, ` +
        `root <${record.rootElement ?? 'none'}>, Location ${record.location ?? 'absent'} → ${file}`,
    );
    // Headers whole, in the log as well as the manifest: a `Location` nobody
    // scrolled to is the same as one nobody recorded.
    logger.info(
      `[${n}] response headers: ${JSON.stringify(responseHeaders, null, 2)}`,
    );
  }

  fs.writeFileSync(
    path.join(outDir, 'manifest.json'),
    JSON.stringify(
      {
        url: sapConfig.url,
        classUri,
        requestBody: xml,
        steps,
      },
      null,
      2,
    ),
    'utf8',
  );

  // The session goes back. A probe that leaves one behind costs the pool the
  // same as a test run does, and the pool is shared.
  await releaseTestConnection(connection);
  logger.info(`Evidence written to ${outDir}`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`probe-abapunit failed: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
