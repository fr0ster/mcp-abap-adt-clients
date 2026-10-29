/**
 * The conformance check of the ADT type tables on a live system (spec 4,
 * item 5): the same check as `unit/conformance/typeTablesConformance.test.ts`,
 * run on what the configured system answers now.
 *
 * - The variant is the configuration's (`environment.system`: `onprem` holds
 *   `ADT_TYPES_ONPREM` to the answers, `cloud` `ADT_TYPES_CLOUD`), and what is
 *   found is compared with the committed lists of the release recorded for it
 *   (`s4-2025`, `abap-cloud`). SAP_BASIS 7.40 is not run here: its live setup
 *   is the 7.40 package's own, and its samples are not recorded yet.
 * - `typestructure` and `discovery` are read through the library
 *   (`getUtils().getTypeStructure()`, `getUtils().discovery()`). The library
 *   has no `urimapper` member, so each sample's `urimapper` read — and its
 *   metadata read, at the address the library builds, with the Accept the
 *   recorded read sent — go through the connection the suites use.
 * - The samples are the recorded ones (`conformance/<release>/_index.json`).
 *   A metadata read that answers 403 is no readable sample; any other failed
 *   read fails the test.
 * - The system's identity is printed at run time and written nowhere.
 *
 * With `CONFORMANCE_WRITE_DIR=<dir>` (refused when `CI` is set) the answers
 * are also written, scrubbed with the corpus placeholders, under
 * `<dir>/{typestructure,discovery,conformance/<release>}/` — the corpus
 * layout; the package README says how they are added to the corpus.
 *
 * Run: `MCP_ENV_PATH=<env> MCP_TEST_OVERLAY=<overlay> npm test --
 * src/__tests__/integration/shared/typeTablesConformance.test.ts`.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { analyseException } from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  ISessionLifecycleAware,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../clients/AdtClient';
import { ACCEPT_DISCOVERY } from '../../../constants/contentTypes';
import { integrationHeadersOf } from '../../helpers/adtHeaders';
import { gateOn } from '../../helpers/caseGate';
import { expectResult } from '../../helpers/contract';
import {
  CORPUS,
  readExchange,
  readSampleIndex,
} from '../../helpers/recordedConformance';
import {
  createTestAdtClient,
  createTestConnection,
  getTargetSystem,
  releaseTestConnection,
  resolveSystemContext,
  sapIsConfigured,
  skipUnlessConfigured,
} from '../../helpers/sessionConfig';
import { createTestsLogger } from '../../helpers/testLogger';
import {
  checkTypeTable,
  conflictLine,
  libraryAddress,
  librarySourceTypesOf,
  readDiscovery,
  readSourceLinkTypes,
  readTypeStructure,
  readUrimapperUri,
  type SampleAnswer,
  TYPE_TABLES,
} from '../../helpers/typeTableConformance';
import {
  CREATE_WITHOUT_CAPABILITY,
  DIVERGENCES,
  METADATA_TYPE_UNADVERTISED,
  NO_READABLE_SAMPLE,
  recordedCoverage,
} from '../../unit/conformance/recorded';

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const testsLogger: ILogger = createTestsLogger();

/** The recorded release each configured variant is compared with. */
const RELEASE_OF = { onprem: 's4-2025', cloud: 'abap-cloud' } as const;

/** One read as it came back, for the check and for the write flag. */
interface ILiveExchange {
  readonly status: number;
  readonly statusText: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly method: string;
  readonly url: string;
  readonly params: Readonly<Record<string, string>> | null;
  readonly accept: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** Response headers as text: from outside the types, so read with checks. */
function headerText(value: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!isRecord(value)) return out;
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null) continue;
    out[key] = Array.isArray(item) ? item.map(String).join(', ') : String(item);
  }
  return out;
}

/**
 * One GET through the connection. A 403 comes back as an answer — it is what
 * "no readable sample" is — and every other failure is thrown, as it is.
 */
async function get(
  connection: IAbapConnection,
  url: string,
  params: Readonly<Record<string, string>> | null,
  accept: string,
  admit403: boolean,
): Promise<ILiveExchange> {
  const request = {
    method: 'GET',
    url,
    params,
    accept,
  };
  try {
    const response = await connection.makeAdtRequest({
      url,
      method: 'GET',
      timeout: 0,
      ...(params ? { params } : {}),
      headers: accept ? { Accept: accept } : {},
    });
    if (typeof response.data !== 'string') {
      throw new Error(`GET ${url}: the answer is not text`);
    }
    return {
      ...request,
      status: response.status,
      statusText: response.statusText,
      headers: headerText(response.headers),
      body: response.data,
    };
  } catch (error) {
    const response = isRecord(error) ? error.response : undefined;
    if (admit403 && isRecord(response) && response.status === 403) {
      return {
        ...request,
        status: 403,
        statusText:
          typeof response.statusText === 'string' ? response.statusText : '',
        headers: headerText(response.headers),
        body: typeof response.data === 'string' ? response.data : '',
      };
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// The write flag
// ---------------------------------------------------------------------------

const REDACTED = 'REDACTED';
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'x-sap-security-session',
  'sap-adt-saplb',
]);

/** The corpus placeholders (corpus README, "What is not in the files"). */
function scrubber(
  replacements: readonly [string | undefined, string][],
): (text: string) => string {
  const pairs = replacements.filter(
    (pair): pair is [string, string] => !!pair[0],
  );
  return (text) =>
    pairs.reduce((out, [from, to]) => out.split(from).join(to), text);
}

interface IWritten {
  readonly dir: string;
  readonly caseName: string;
  readonly step: number;
  readonly stepTag: string;
}

function writeExchange(
  where: IWritten,
  exchange: ILiveExchange,
  scrub: (text: string) => string,
): void {
  fs.mkdirSync(where.dir, { recursive: true });
  const base = `${where.caseName}--${String(where.step).padStart(2, '0')}-${where.stepTag}`;
  const bodyFile = `${base}.body.xml`;
  const params = exchange.params
    ? Object.fromEntries(
        Object.entries(exchange.params).map(([k, v]) => [k, scrub(v)]),
      )
    : null;
  const query = params ? new URLSearchParams(params).toString() : '';
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(exchange.headers)) {
    headers[key] = SENSITIVE_HEADERS.has(key.toLowerCase())
      ? REDACTED
      : scrub(value);
  }
  const sidecar = {
    case: where.caseName,
    step: where.step,
    stepTag: where.stepTag,
    capturedAt: new Date().toISOString(),
    request: {
      method: exchange.method,
      url: scrub(exchange.url),
      params,
      effectiveUrl: scrub(query ? `${exchange.url}?${query}` : exchange.url),
      headers: exchange.accept ? { Accept: exchange.accept } : {},
      headersNote:
        'Caller-supplied headers only. Recorded by the live conformance check (typeTablesConformance.test.ts); the connection added the authentication and the session, none of which is recorded.',
      body: null,
    },
    response: {
      status: exchange.status,
      statusText: exchange.statusText,
      headers,
      bodyFile,
    },
  };
  fs.writeFileSync(path.join(where.dir, bodyFile), scrub(exchange.body));
  fs.writeFileSync(
    path.join(where.dir, `${base}.json`),
    `${JSON.stringify(sidecar, null, 2)}\n`,
  );
}

/** The directory the write flag names, refused under CI. */
function writeDir(): string | undefined {
  const dir = process.env.CONFORMANCE_WRITE_DIR?.trim();
  if (!dir) return undefined;
  if (process.env.CI) {
    throw new Error(
      'CONFORMANCE_WRITE_DIR is refused when CI is set: answers are written only by a hand run',
    );
  }
  return path.resolve(dir);
}

// ---------------------------------------------------------------------------

const configured = sapIsConfigured();

describe(
  configured
    ? 'type tables conformance, live'
    : 'type tables conformance, live: skipped — no live configuration (SAP_URL is not set; MCP_ENV_PATH names none)',
  () => {
    let connection: IAbapConnection & ISessionLifecycleAware;
    let client: AdtClient;

    beforeAll(async () => {
      try {
        connection = await createTestConnection(testsLogger);
        ({ client } = await createTestAdtClient(connection, testsLogger));
      } catch (error) {
        skipUnlessConfigured(error, testsLogger);
      }
    });

    afterAll(async () => {
      if (connection) await releaseTestConnection(connection);
    });

    gateOn(() => true)(
      "the configured variant's table conforms to what the system answers",
      async () => {
        const out = writeDir();
        const variant = getTargetSystem();
        const release = RELEASE_OF[variant];
        const table = TYPE_TABLES[variant];
        if (!table) throw new Error(`no table for ${variant}`);
        const context = await resolveSystemContext(
          connection,
          variant === 'cloud',
        );
        const host = new URL(process.env.SAP_URL ?? '').host;
        // The identity, printed here and written nowhere.
        process.stdout.write(
          `conformance: ${variant} (${release}) against ${host}, system ${context.masterSystem ?? '(unknown)'}, user ${context.responsible ?? '(unknown)'}\n`,
        );

        const utils = client.getUtils();
        const typestructure = expectResult(
          await utils.getTypeStructure({
            headers: integrationHeadersOf(utils, 'getTypeStructure'),
            analyse: analyseException,
          }),
          'typestructure',
        );
        const discovery = expectResult(
          await utils.discovery(undefined, { analyse: analyseException }),
          'discovery',
        );

        const index = readSampleIndex(release);
        if (!index) throw new Error(`no samples are recorded for ${release}`);
        const recordedDir = path.join(CORPUS, 'conformance', release);
        const samples = new Map<string, SampleAnswer>();
        const exchanges = new Map<string, ILiveExchange[]>();
        for (const [code, sample] of index) {
          const template = readExchange(recordedDir, sample.files.template);
          const mapper = readExchange(recordedDir, sample.files.urimapper);
          const metadata = readExchange(recordedDir, sample.files.metadata);
          const urimapper = await get(
            connection,
            mapper.url,
            mapper.params,
            mapper.accept,
            false,
          );
          const read = await get(
            connection,
            libraryAddress(code, sample.name, sample.parent),
            metadata.params,
            metadata.accept,
            true,
          );
          samples.set(
            code,
            read.status === 403
              ? {
                  readable: false,
                  name: sample.name,
                  reason: 'the metadata read answered 403',
                }
              : {
                  readable: true,
                  name: sample.name,
                  parent: sample.parent,
                  urimapperUri: readUrimapperUri(urimapper.body),
                  sourceLinkTypes: readSourceLinkTypes(read.body),
                },
          );
          if (out) {
            const templateRead = await get(
              connection,
              template.url,
              template.params,
              template.accept,
              true,
            );
            exchanges.set(code, [templateRead, urimapper, read]);
          }
        }

        const report = checkTypeTable(
          table,
          {
            types: readTypeStructure(typestructure),
            collections: readDiscovery(discovery),
            samples,
          },
          await librarySourceTypesOf(table),
        );

        if (out) {
          const scrub = scrubber([
            [process.env.SAP_PASSWORD, REDACTED],
            [process.env.SAP_JWT_TOKEN, REDACTED],
            [process.env.SAP_REFRESH_TOKEN, REDACTED],
            [process.env.SAP_UAA_CLIENT_SECRET, REDACTED],
            [
              host,
              variant === 'cloud' ? 'abap-cloud.example' : 'sap.example.local',
            ],
            [context.responsible, 'SAPUSER01'],
            [context.masterSystem, 'SYS'],
          ]);
          const caseName = `system-description-${release}`;
          writeExchange(
            {
              dir: path.join(out, 'typestructure'),
              caseName,
              step: 7,
              stepTag: 'typestructure',
            },
            {
              status: 200,
              statusText: 'OK',
              headers: {},
              body: typestructure,
              method: 'POST',
              url: '/sap/bc/adt/repository/typestructure',
              params: null,
              accept: integrationHeadersOf(utils, 'getTypeStructure').accept,
            },
            scrub,
          );
          writeExchange(
            {
              dir: path.join(out, 'discovery'),
              caseName,
              step: 3,
              stepTag: 'discovery',
            },
            {
              status: 200,
              statusText: 'OK',
              headers: {},
              body: discovery,
              method: 'GET',
              url: '/sap/bc/adt/discovery',
              params: null,
              accept: ACCEPT_DISCOVERY,
            },
            scrub,
          );
          const dir = path.join(out, 'conformance', release);
          const indexed: Record<string, unknown> = {};
          for (const [code, sample] of index) {
            const [template, urimapper, read] = exchanges.get(code) ?? [];
            if (!template || !urimapper || !read) continue;
            const suffix = '--01-template.json';
            if (!sample.files.template.endsWith(suffix)) {
              throw new Error(
                `${code}: template file ${sample.files.template}`,
              );
            }
            const caseName = sample.files.template.slice(0, -suffix.length);
            const steps: [number, string, ILiveExchange][] = [
              [1, 'template', template],
              [2, 'urimapper', urimapper],
              [3, 'metadata', read],
            ];
            for (const [step, stepTag, exchange] of steps) {
              writeExchange({ dir, caseName, step, stepTag }, exchange, scrub);
            }
            const answer = samples.get(code);
            indexed[code] = {
              sample: { name: sample.name, parent: sample.parent },
              statuses: {
                template: template.status,
                urimapper: urimapper.status,
                metadata: read.status,
              },
              urimapperUri:
                answer?.readable === true ? answer.urimapperUri : null,
              libraryUri: libraryAddress(code, sample.name, sample.parent),
              files: sample.files,
              ...(answer?.readable === false ? { reason: answer.reason } : {}),
            };
          }
          fs.writeFileSync(
            path.join(dir, '_index.json'),
            `${JSON.stringify({ release, codes: indexed }, null, 2)}\n`,
          );
          process.stdout.write(`conformance: answers written to ${out}\n`);
        }

        expect(report.conflicts.map(conflictLine).sort()).toEqual(
          DIVERGENCES[release].map(conflictLine).sort(),
        );
        expect(report.createWithoutCapability).toEqual(
          CREATE_WITHOUT_CAPABILITY[release],
        );
        expect(report.metadataTypeUnadvertised).toEqual(
          METADATA_TYPE_UNADVERTISED[release],
        );
        const coverage = recordedCoverage(release);
        expect(report.notCreated).toEqual(coverage.notCreated);
        expect(Object.keys(report.unserved)).toEqual(coverage.unserved);
        expect(report.capabilityNotUsed).toEqual(coverage.capabilityNotUsed);
        expect(Object.keys(report.unreadable)).toEqual(
          Object.keys(NO_READABLE_SAMPLE[release]),
        );
      },
      600000,
    );
  },
);
