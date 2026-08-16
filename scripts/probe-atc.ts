/**
 * ATC probe — captures the traffic the ATC spec is blocked on.
 *
 * The spec (`docs/superpowers/specs/2026-08-15-atc-run-and-findings.md`) is
 * complete except for facts nobody has captured. This script captures them and
 * writes every request and response to disk verbatim, so the spec can quote a
 * response rather than an expectation.
 *
 * What it settles, on whichever system `.env` points at:
 *
 * Three of these block the contract — the checkable set, the customizing verb,
 * and whether a run has an id of its own. Each is something the spec already
 * asserts, so an answer can refute it, not merely fill it in.
 *
 *  1. **`AtcObjectType`** — a blocker. Every candidate type is probed from a
 *     **required list**, not from whatever a package happens to contain, and a
 *     candidate is **confirmed only when a FINISHED worklist lists its
 *     object** — not when a run is accepted, which happens for a URI that
 *     cannot exist too. Anything short of that exits non-zero, naming which of
 *     the three it got to: never asked, never finished, or finished without
 *     the object in the list.
 *  2. **The mapping itself.** The public contract takes `objectType` +
 *     `objectName`, so the client must *build* the URI — which means the thing
 *     under test is the template, not the object. Each candidate is run at the
 *     URI **this probe builds**, and separately at the URI **ADT returned** for
 *     the same object when the two differ. Running only ADT's URI would prove a
 *     ready-made URI is checkable and say nothing about the mapping.
 *  3. **Whether a run has its own id.** The disputed claim is #68's separate run
 *     id from the `Location` header. So the run response's headers are read, and
 *     if a `Location` is there, **that** id is fetched. The worklist id is
 *     fetched too, as a separate step — a 404 for the wrong id would otherwise
 *     read as "no status resource" when it is only "not that resource".
 *  4. **`GET` or `POST /atc/customizing`** — #68 sends GET, the spec's traffic
 *     table recorded POST. Both are sent; whichever answers is the fact.
 *  5. Plural object references; the loose ends `includeExemptedFindings=true`,
 *     `checkstyle`, `maximumVerdicts` at its edges and `clientWait=true`; and
 *     **a control URI that cannot exist, read back like any candidate**. The
 *     read is the point: if the bogus run and a real one both answer 200, only
 *     their two worklists separate "ATC checked this" from "ATC accepted
 *     anything and checked nothing".
 *  6. **What the `FINDING_STATS` positions mean** — but only if `--known-bad`
 *     names an object that fails its checks. Representatives are picked by
 *     type, not by being dirty, so they may all be clean, and `0,0,0` reads the
 *     same in every severity order. When no non-zero triple is seen the probe
 *     says so rather than leaving the silence to be read as an answer.
 *
 * Nothing is interpreted here. Every step is recorded with its status and body
 * whether it succeeds or fails, because a 406 and a 404 are results too — three
 * of the spec's recorded facts are error responses.
 *
 * Usage:
 *   npx ts-node scripts/probe-atc.ts
 *   npx ts-node scripts/probe-atc.ts --package=ZADT_BLD_PKG03 --out=atc-probe
 *   MCP_ENV_PATH=./trial.env npx ts-node scripts/probe-atc.ts
 *
 * Flags:
 *   --package=NAME   package to take representative objects from
 *                    (default: `environment.default_package` from test-config.yaml)
 *   --out=DIR        where to write the evidence (default: atc-probe/)
 *   --extras         also probe types found in the package that are not
 *                    candidates — off by default, since they answer nothing the
 *                    contract asks
 *   --known-bad=KEY:NAME
 *                    an object known to FAIL its checks, e.g.
 *                    `--known-bad=class:ZCL_ATC_DIRTY`. Without one, every
 *                    representative may be clean, every FINDING_STATS reads
 *                    `0,0,0`, and what the three positions mean stays unknown —
 *                    a triple of zeroes is the one value that tells you nothing
 *                    about the ordering. KEY is a candidate key (`class`,
 *                    `program`, …)
 *
 * Exit code is **1 unless every candidate is confirmed**, so an incomplete
 * probe cannot be mistaken for a finished one.
 *
 * Writes `DIR/manifest.json` (every step, plus the verdict, machine-readable)
 * and one raw body file per step. Read the raw files — the manifest is an index,
 * not a summary.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import {
  type IAbapConnection,
  type ILogger,
  LogLevel,
} from '@mcp-abap-adt/interfaces';
import { DefaultLogger } from '@mcp-abap-adt/logger';
import * as dotenv from 'dotenv';
import { getConfig } from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { AdtUtils } from '../src/core/shared/AdtUtils';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

/** Content types, copied from PR #68 so the probe sends what it sent. */
const CT_ATC_WORKLIST_CREATE = 'text/plain';
const ACCEPT_ATC_WORKLIST_ID = 'text/plain';
const CT_ATC_RUN = 'application/xml';
const ACCEPT_ATC_RUN_RESPONSE = 'application/xml';
const ACCEPT_ATC_RUN_STATUS = 'application/vnd.sap.adt.backgroundrun.v1+xml';
const ACCEPT_ATC_WORKLIST_XML =
  'application/atc.worklist.v1+xml, application/vnd.sap.atc.worklist.v1+xml';
const ACCEPT_ATC_WORKLIST_CHECKSTYLE =
  'application/vnd.sap.atc.checkstyle.v1+xml, application/vnd.sap.atc.checkstyle+xml';
const ACCEPT_ATC_VARIANTS =
  'application/vnd.sap.adt.nameditems.v1+xml, application/xml';
const ACCEPT_ATC_CUSTOMIZING =
  'application/xml, application/vnd.sap.atc.customizing-v1+xml, application/vnd.sap.atc.customizing-v2+xml';

const ATC = '/sap/bc/adt/atc';
const TIMEOUT = 60_000;

/** How long to wait for a run before giving up and saying so. */
const RUN_POLL_ATTEMPTS = 20;
const RUN_POLL_DELAY_MS = 3_000;

/** A URI template under test, and who proposes it. */
interface ITemplate {
  /** How this template is referred to in the manifest and in the spec. */
  label: string;
  build: (name: string) => string;
}

/**
 * The types `AtcObjectType` might name, each with the template a client would
 * have to build for it.
 *
 * The list is **required**, not discovered: it is #68's six (the set the spec
 * says must be measured) plus the three the spec adds — DDL source, table and
 * behavior definition — which #68 does not map at all, and which therefore
 * cannot be checked through it even if ATC accepts them.
 *
 * Every template here is the one this repository already uses for that object
 * elsewhere. `include` carries **two**: #68 sends includes to
 * `/programs/programs/`, while the library builds `/programs/includes/`. They
 * cannot both be right, so both are run.
 */
interface ICandidate {
  key: string;
  /** ADT type codes a package listing may report for this kind. */
  typeCodes: string[];
  /**
   * The `adtcore:type` a worklist uses for this kind — `CLAS`, not `CLAS/OC`.
   * Confirmation compares BOTH this and the name: a run at
   * `/programs/programs/{NAME}` can come back listing a PROG with that name,
   * and matching on the name alone would then confirm `include` on the
   * strength of a program. Raised in review, 2026-08-16.
   */
  worklistTypeCode: string;
  templates: ITemplate[];
  /** Whether #68 maps this type at all. */
  mappedBy68: boolean;
  /**
   * `cloud` — v1 needs this confirmed, and an unconfirmed one fails the probe.
   * `onprem` — the object cannot exist on ABAP Cloud, so this trial can never
   * confirm it. Reported, never counted against the run: the spec ships the
   * cloud-confirmed union and widens it from an on-prem probe.
   */
  scope: 'cloud' | 'onprem';
}

const CANDIDATES: ICandidate[] = [
  {
    key: 'class',
    worklistTypeCode: 'CLAS',
    scope: 'cloud',
    typeCodes: ['CLAS/OC'],
    templates: [
      { label: 'oo/classes', build: (n) => `/sap/bc/adt/oo/classes/${n}` },
    ],
    mappedBy68: true,
  },
  {
    key: 'interface',
    worklistTypeCode: 'INTF',
    scope: 'cloud',
    typeCodes: ['INTF/OI'],
    templates: [
      {
        label: 'oo/interfaces',
        build: (n) => `/sap/bc/adt/oo/interfaces/${n}`,
      },
    ],
    mappedBy68: true,
  },
  {
    key: 'program',
    worklistTypeCode: 'PROG',
    scope: 'onprem',
    typeCodes: ['PROG/P'],
    templates: [
      {
        label: 'programs/programs',
        build: (n) => `/sap/bc/adt/programs/programs/${n}`,
      },
    ],
    mappedBy68: true,
  },
  {
    key: 'include',
    worklistTypeCode: 'PROG',
    scope: 'onprem',
    typeCodes: ['PROG/I'],
    templates: [
      // #68 sends includes here, to the program URI.
      {
        label: 'programs/programs (as #68 builds it)',
        build: (n) => `/sap/bc/adt/programs/programs/${n}`,
      },
      // The library builds this one for includes everywhere else.
      {
        label: 'programs/includes (as this library builds it)',
        build: (n) => `/sap/bc/adt/programs/includes/${n}`,
      },
    ],
    mappedBy68: true,
  },
  {
    key: 'function_group',
    worklistTypeCode: 'FUGR',
    scope: 'cloud',
    typeCodes: ['FUGR/F', 'FUGR'],
    templates: [
      {
        label: 'functions/groups',
        build: (n) => `/sap/bc/adt/functions/groups/${n}`,
      },
    ],
    mappedBy68: true,
  },
  {
    key: 'package',
    worklistTypeCode: 'DEVC',
    scope: 'cloud',
    typeCodes: ['DEVC/K', 'DEVC'],
    templates: [
      { label: 'packages', build: (n) => `/sap/bc/adt/packages/${n}` },
    ],
    mappedBy68: true,
  },
  {
    key: 'ddl_source',
    worklistTypeCode: 'DDLS',
    scope: 'cloud',
    typeCodes: ['DDLS/DF'],
    templates: [
      {
        label: 'ddic/ddl/sources',
        build: (n) => `/sap/bc/adt/ddic/ddl/sources/${n}`,
      },
    ],
    mappedBy68: false,
  },
  {
    key: 'table',
    worklistTypeCode: 'TABL',
    scope: 'cloud',
    typeCodes: ['TABL/DT'],
    templates: [
      { label: 'ddic/tables', build: (n) => `/sap/bc/adt/ddic/tables/${n}` },
    ],
    mappedBy68: false,
  },
  {
    key: 'behavior_definition',
    worklistTypeCode: 'BDEF',
    scope: 'cloud',
    typeCodes: ['BDEF/BDO'],
    templates: [
      {
        label: 'bo/behaviordefinitions',
        build: (n) => `/sap/bc/adt/bo/behaviordefinitions/${n}`,
      },
    ],
    mappedBy68: false,
  },
];

interface IStep {
  n: number;
  step: string;
  /** What this step is meant to settle — so a reader knows why it is here. */
  answers: string;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: string;
  };
  status: number | null;
  statusText?: string;
  /**
   * Wall-clock milliseconds. Without it "the run was finished when I asked"
   * cannot be told from "the server held my request until it finished", which
   * is the whole question long polling asks.
   */
  durationMs: number;
  responseHeaders?: Record<string, unknown>;
  bodyFile?: string;
  bodyPreview?: string;
  error?: string;
}

interface ICallResult {
  status: number | null;
  body: string;
  headers: Record<string, unknown>;
  step: number;
  durationMs: number;
}

class Recorder {
  private readonly steps: IStep[] = [];
  private n = 0;
  /**
   * Every FINDING_STATS this session saw, from any response. The triple's
   * positions can only be decoded from a run that found something: `0,0,0`
   * looks identical whichever order the severities are in.
   */
  readonly findingStats: {
    step: number;
    label: string;
    triple: string | null;
    context: string;
  }[] = [];

  constructor(
    private readonly connection: IAbapConnection,
    private readonly outDir: string,
    private readonly logger: ILogger,
  ) {}

  /**
   * Issue one request and record it whichever way it goes. A rejection is not
   * a failure of the probe — `checkstyle → 406` and `runs/{id} → 404` are two
   * of the facts this is here to confirm.
   */
  async call(
    step: string,
    answers: string,
    req: {
      method: string;
      url: string;
      headers: Record<string, string>;
      body?: string;
    },
  ): Promise<ICallResult> {
    this.n += 1;
    const n = this.n;
    const record: IStep = {
      n,
      step,
      answers,
      request: req,
      status: null,
      durationMs: 0,
    };
    this.logger.info(`[${n}] ${step} — ${req.method} ${req.url}`);

    const startedAt = Date.now();
    let body = '';
    let headers: Record<string, unknown> = {};
    try {
      const response = await this.connection.makeAdtRequest({
        url: req.url,
        method: req.method as 'GET' | 'POST',
        timeout: TIMEOUT,
        ...(req.body !== undefined ? { data: req.body } : {}),
        headers: req.headers,
      });
      record.status = response.status;
      record.statusText = response.statusText;
      headers = (response.headers ?? {}) as Record<string, unknown>;
      record.responseHeaders = headers;
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
      headers = e.response?.headers ?? {};
      record.responseHeaders = headers;
      record.error = e.message ?? String(error);
      const data = e.response?.data;
      body = typeof data === 'string' ? data : data ? JSON.stringify(data) : '';
      this.logger.warn(
        `[${n}] ${step} → ${record.status ?? 'no status'}: ${record.error}`,
      );
    }

    // Scanned here rather than at the call sites: the run that actually carried
    // FINDING_STATS on the trial was `clientWait=true`, which is issued
    // directly and not through `runAt` — so a scan attached to `runAt` reported
    // "never appeared" about a response holding it. Caught by running the
    // probe, 2026-08-16.
    const stats = parseFindingStats(body);
    if (stats) {
      this.findingStats.push({
        step: n,
        label: step,
        triple: stats.triple,
        context: stats.context,
      });
    }

    record.durationMs = Date.now() - startedAt;

    const file = `${String(n).padStart(2, '0')}-${step.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    fs.writeFileSync(path.join(this.outDir, file), body, 'utf8');
    record.bodyFile = file;
    record.bodyPreview = body.slice(0, 400);
    this.steps.push(record);
    this.logger.info(
      `[${n}] → ${record.status ?? 'no status'}, ${body.length} bytes, ${record.durationMs}ms → ${file}`,
    );
    return {
      status: record.status,
      body,
      headers,
      step: n,
      durationMs: record.durationMs,
    };
  }

  flush(extra: Record<string, unknown>): void {
    fs.writeFileSync(
      path.join(this.outDir, 'manifest.json'),
      JSON.stringify({ ...extra, steps: this.steps }, null, 2),
      'utf8',
    );
  }
}

/** The run payload, with as many object references as it is given. */
function runBody(uris: string[], maximumVerdicts: number): string {
  const refs = uris
    .map((uri) => `<adtcore:objectReference adtcore:uri="${uri}"/>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<atc:run maximumVerdicts="${maximumVerdicts}" xmlns:atc="http://www.sap.com/adt/atc">` +
    '<objectSets xmlns:adtcore="http://www.sap.com/adt/core">' +
    '<objectSet kind="inclusive">' +
    `<adtcore:objectReferences>${refs}</adtcore:objectReferences>` +
    '</objectSet>' +
    '</objectSets>' +
    '</atc:run>'
  );
}

function parseSystemCheckVariant(body: string): string | null {
  const match = body.match(/name="systemCheckVariant"[^>]*value="([^"]+)"/);
  return match ? match[1] : null;
}

/** The worklist id comes back as a bare 32-char string, per the spec's table. */
function parseWorklistId(body: string): string | null {
  const trimmed = body.trim();
  return /^[A-Za-z0-9]{20,}$/.test(trimmed) ? trimmed : null;
}

/**
 * Pull `FINDING_STATS` out of a run response.
 *
 * The spec records it as a comma triple in a `description`, but not which
 * element carries it, so this keeps a window of the raw text around the match
 * as well as the triple — a human reading the evidence can then see the shape
 * even where the extraction misses.
 */
function parseFindingStats(
  body: string,
): { triple: string | null; context: string } | null {
  const at = body.indexOf('FINDING_STATS');
  if (at === -1) return null;
  const context = body.slice(Math.max(0, at - 200), at + 300);
  const triple = context.match(/(\d+\s*,\s*\d+\s*,\s*\d+)/);
  return { triple: triple ? triple[1] : null, context };
}

/** Header lookup that does not assume the server's capitalisation. */
function header(
  headers: Record<string, unknown>,
  name: string,
): string | undefined {
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  const value = key ? headers[key] : undefined;
  return typeof value === 'string' ? value : undefined;
}

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  const knownBad = get('known-bad');
  const [knownBadType, knownBadName] = knownBad
    ? knownBad.split(':')
    : [undefined, undefined];
  return {
    packageName: get('package'),
    outDir: get('out') ?? 'atc-probe',
    extras: argv.includes('--extras'),
    knownBadType,
    knownBadName,
  };
}

function defaultPackageFromTestConfig(logger: ILogger): string | undefined {
  try {
    // test-helper is a plain JS helper; it reads test-config.yaml.
    const {
      getEnvironmentConfig,
    } = require('../src/__tests__/helpers/test-helper');
    return getEnvironmentConfig()?.default_package;
  } catch (error) {
    logger.warn(`Could not read test-config.yaml: ${String(error)}`);
    return undefined;
  }
}

/** What the probe managed to establish for one candidate type. */
interface ICandidateOutcome {
  key: string;
  mappedBy68: boolean;
  representative: { name: string; type: string; adtUri?: string } | null;
  /** Every URI tried for it, with the step that tried it. */
  attempts: {
    template: string;
    uri: string;
    step: number;
    status: number | null;
  }[];
  /** ADT's own URI, run only when it differs from every built one. */
  adtUriAttempt?: {
    uri: string;
    step: number;
    status: number | null;
  };
  /**
   * Three separate facts, because collapsing them is how this probe reported
   * success for types it had proven nothing about. Raised in review,
   * 2026-08-16.
   *
   * - `attempted`: a run was issued. Says nothing — a URI that cannot exist is
   *   accepted with 201 too.
   * - `finished`: the run resource reported finished, so the worklist read
   *   after it means something.
   * - `confirmed`: the finished worklist **lists this object**. That is the
   *   evidence rule, and the only one of the three that extends
   *   `AtcObjectType`.
   */
  attempted: boolean;
  finished: boolean;
  confirmed: boolean;
  /** What the finished worklist said was checked, for the record. */
  objectsListed?: { type: string; name: string }[];
  /** Why it was never asked, in the manifest rather than only in the log. */
  reason?: string;
}

async function main(): Promise<void> {
  // A probe that says nothing while it works is unusable; INFO regardless of
  // the DEBUG_* flags, which gate the library's own loggers.
  const logger: ILogger = new DefaultLogger(LogLevel.INFO);
  const args = parseArgs(process.argv.slice(2));

  const outDir = path.resolve(process.cwd(), args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const sapConfig = getConfig();
  const connection = createAbapConnection(sapConfig, createConnectionLogger());
  await connection.connect();
  logger.info(`Connected to ${sapConfig.url}`);

  const rec = new Recorder(connection, outDir, logger);
  const utils = new AdtUtils(connection, logger);

  // --- 1. Where does the check variant come from, and by which verb? --------
  const customizingGet = await rec.call(
    'customizing-GET',
    'PR #68 sends GET here; the spec recorded POST. Which one answers?',
    {
      method: 'GET',
      url: `${ATC}/customizing`,
      headers: { Accept: ACCEPT_ATC_CUSTOMIZING },
    },
  );
  const customizingPost = await rec.call(
    'customizing-POST',
    'The other half of the same contradiction.',
    {
      method: 'POST',
      url: `${ATC}/customizing`,
      headers: {
        Accept: ACCEPT_ATC_CUSTOMIZING,
        'Content-Type': 'application/xml',
      },
      body: '',
    },
  );

  await rec.call(
    'variants',
    'The spec claims totalItemCount 0 on the trial — i.e. customizing is the only source of a variant.',
    {
      method: 'GET',
      url: `${ATC}/variants?maxItemCount=500&name=*`,
      headers: { Accept: ACCEPT_ATC_VARIANTS },
    },
  );

  const variantFromGet = parseSystemCheckVariant(customizingGet.body);
  const checkVariant =
    variantFromGet ?? parseSystemCheckVariant(customizingPost.body);
  if (!checkVariant) {
    logger.error(
      'No systemCheckVariant in either customizing response. Everything below needs one; stopping here with the evidence written.',
    );
    rec.flush({
      system: sapConfig.url,
      checkVariant: null,
      verdict: 'incomplete: no check variant',
    });
    process.exitCode = 1;
    return;
  }
  logger.info(
    `Check variant: ${checkVariant} (from ${variantFromGet ? 'GET' : 'POST'} /atc/customizing)`,
  );

  // --- 2. Representative objects for the required candidate list ------------
  const packageName = args.packageName ?? defaultPackageFromTestConfig(logger);
  if (!packageName) {
    logger.error(
      'No package to probe. Pass --package=NAME or set environment.default_package in test-config.yaml.',
    );
    rec.flush({
      system: sapConfig.url,
      checkVariant,
      verdict: 'incomplete: no package',
    });
    process.exitCode = 1;
    return;
  }

  logger.info(`Reading contents of ${packageName}`);
  const contents = await utils.getPackageContentsList(packageName, {
    includeSubpackages: true,
  });

  const firstOfType = new Map<
    string,
    { name: string; type: string; uri?: string }
  >();
  for (const item of contents) {
    if (!firstOfType.has(item.type)) {
      firstOfType.set(item.type, {
        name: item.name,
        type: item.type,
        uri: item.uri,
      });
    }
  }
  // The probed package is its own representative for the `package` candidate:
  // a package never appears in its own contents listing.
  if (!firstOfType.has('DEVC/K')) {
    firstOfType.set('DEVC/K', { name: packageName, type: 'DEVC/K' });
  }

  const outcomes: ICandidateOutcome[] = [];

  /** One worklist per run: reusing one would blur whose findings are whose. */
  const newWorklist = async (label: string): Promise<string | null> => {
    const res = await rec.call(
      `worklist-${label}`,
      'Creates the worklist the following run writes into.',
      {
        method: 'POST',
        url: `${ATC}/worklists?checkVariant=${encodeURIComponent(checkVariant)}`,
        headers: {
          'Content-Type': CT_ATC_WORKLIST_CREATE,
          Accept: ACCEPT_ATC_WORKLIST_ID,
        },
        body: '',
      },
    );
    const id = parseWorklistId(res.body);
    if (!id) {
      logger.warn(
        `No worklist id parsed from ${label}: ${res.body.slice(0, 120)}`,
      );
    }
    return id;
  };

  /**
   * Runs the server accepted, in order. An array rather than a `let`: the push
   * happens inside `runAt`'s closure, which TypeScript's flow analysis does not
   * follow, so a nullable variable narrows to `null` at the read below and
   * makes the whole run-id block unreachable.
   */
  const acceptedRuns: { run: ICallResult; worklistId: string }[] = [];

  /**
   * Which objects a finished worklist says were checked, as {type, name}.
   *
   * The type is not decoration. A run at `/programs/programs/{NAME}` can come
   * back listing a `PROG` of that name, and a name-only match would then
   * confirm `include` on the evidence of a program — which is the one mapping
   * question this probe exists to settle.
   */
  function objectsIn(worklistXml: string): { type: string; name: string }[] {
    return [...worklistXml.matchAll(/<atcobject:object[^>]*>/g)]
      .map((m) => m[0])
      .map((tag) => ({
        type: tag.match(/adtcore:type="([^"]+)"/)?.[1] ?? '',
        name: tag.match(/adtcore:name="([^"]+)"/)?.[1] ?? '',
      }))
      .filter((o) => o.name);
  }

  /**
   * Poll the run resource until it reports finished.
   *
   * This is the whole difference between a measurement and a coin toss.
   * Reading a worklist before the checks finish returns one that is empty
   * whatever the object was — the same bytes a run over a URI that cannot
   * exist produces — so the earlier version of this probe manufactured the
   * exact ambiguity the spec warns about. Raised in review, 2026-08-16.
   */
  const waitForRun = async (
    label: string,
    run: ICallResult,
  ): Promise<{ finished: boolean; status: string | null }> => {
    const location =
      header(run.headers, 'location') ??
      header(run.headers, 'content-location');
    if (!location) {
      logger.warn(
        `${label}: the run carried no Location, so there is no run resource to wait on`,
      );
      return { finished: false, status: null };
    }
    const runId = location.split('/').filter(Boolean).pop() ?? location;
    const url = location.startsWith('/')
      ? location
      : `${ATC}/runs/${encodeURIComponent(runId)}`;

    for (let attempt = 1; attempt <= RUN_POLL_ATTEMPTS; attempt++) {
      const res = await rec.call(
        `status-${label}-${attempt}`,
        'Has this run finished? The worklist means nothing until it has.',
        { method: 'GET', url, headers: { Accept: ACCEPT_ATC_RUN_STATUS } },
      );
      const status = res.body.match(/runs:status="([^"]+)"/)?.[1] ?? null;
      // Exact, case-normalised — the same test `IAtcRunStatus.isFinished` will
      // make. A substring match accepts `unfinished` and `not_finished`, which
      // would open the worklist early and could confirm a type on a run that
      // had not run. Raised in review, 2026-08-16.
      if (status?.trim().toLowerCase() === 'finished') {
        return { finished: true, status };
      }
      logger.info(`${label}: run status ${status ?? 'unreadable'}, waiting…`);
      await new Promise((r) => setTimeout(r, RUN_POLL_DELAY_MS));
    }
    return { finished: false, status: 'gave up waiting' };
  };

  /**
   * Start a run, wait for it, and read the worklist it wrote into.
   *
   * Returns what the evidence rule needs: whether the run finished, and which
   * objects the finished worklist lists.
   */
  const runAt = async (
    label: string,
    answers: string,
    uris: string[],
    options?: { readBack?: boolean; maximumVerdicts?: number },
  ): Promise<{
    run: ICallResult;
    worklistId: string;
    finished: boolean;
    objects: { type: string; name: string }[];
  } | null> => {
    const worklistId = await newWorklist(label);
    if (!worklistId) return null;
    const run = await rec.call(`run-${label}`, answers, {
      method: 'POST',
      url: `${ATC}/runs?worklistId=${encodeURIComponent(worklistId)}&clientWait=false`,
      headers: { 'Content-Type': CT_ATC_RUN, Accept: ACCEPT_ATC_RUN_RESPONSE },
      body: runBody(uris, options?.maximumVerdicts ?? 100),
    });
    // The first run the server accepted is the one every id question is asked
    // against — it does not matter which candidate produced it.
    if (run.status !== null && run.status >= 200 && run.status < 300) {
      acceptedRuns.push({ run, worklistId });
    }

    let finished = false;
    let objects: { type: string; name: string }[] = [];
    if (options?.readBack !== false) {
      ({ finished } = await waitForRun(label, run));
      const findings = await rec.call(
        `findings-${label}`,
        finished
          ? 'The finished worklist: every object it lists was checked, findings or not.'
          : 'The worklist, read WITHOUT a finished run — recorded, but it proves nothing.',
        {
          method: 'GET',
          url: `${ATC}/worklists/${encodeURIComponent(worklistId)}?includeExemptedFindings=false`,
          headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
        },
      );
      if (finished) objects = objectsIn(findings.body);
    }
    return { run, worklistId, finished, objects };
  };

  // --- 3. The blocker, measured against the required list ------------------
  for (const candidate of CANDIDATES) {
    const outcome: ICandidateOutcome = {
      key: candidate.key,
      mappedBy68: candidate.mappedBy68,
      representative: null,
      attempts: [],
      attempted: false,
      finished: false,
      confirmed: false,
    };
    outcomes.push(outcome);

    const found = candidate.typeCodes
      .map((code) => firstOfType.get(code))
      .find((hit) => hit !== undefined);

    if (!found) {
      outcome.reason = `no object of ${candidate.typeCodes.join(' / ')} in ${packageName}`;
      logger.warn(`UNMEASURED ${candidate.key}: ${outcome.reason}`);
      continue;
    }
    outcome.representative = {
      name: found.name,
      type: found.type,
      adtUri: found.uri,
    };

    // Encoded then uppercased, which is what #68 does (`encodeSapObjectName`
    // then `.toUpperCase()`). Mirroring it is the point: the URI under test has
    // to be the one a client would build, quirks included.
    const encoded = encodeURIComponent(found.name).toUpperCase();
    for (const template of candidate.templates) {
      const uri = template.build(encoded);
      const label = `${candidate.key}-${template.label.replace(/[^a-z0-9]+/gi, '-')}`;
      const result = await runAt(
        label,
        `Is ${candidate.key} checkable at a URI a client BUILDS (${template.label})? This is the AtcObjectType blocker — ${found.name}.`,
        [uri],
      );
      outcome.attempts.push({
        template: template.label,
        uri,
        step: result?.run.step ?? -1,
        status: result?.run.status ?? null,
      });
      if (result) {
        outcome.attempted = true;
        if (result.finished) {
          outcome.finished = true;
          outcome.objectsListed = result.objects;
          // The evidence rule: the finished worklist lists an object of THIS
          // type under THIS name. Both halves, for the reason in objectsIn.
          if (
            result.objects.some(
              (o) =>
                o.name.toUpperCase() === found.name.toUpperCase() &&
                o.type.toUpperCase() === candidate.worklistTypeCode,
            )
          ) {
            outcome.confirmed = true;
          }
        }
      }
    }

    // ADT's own URI, only when no built URI already matched it — otherwise the
    // two are the same request and running it twice would prove nothing.
    const builtUris = outcome.attempts.map((a) => a.uri);
    if (found.uri && !builtUris.includes(found.uri)) {
      const result = await runAt(
        `${candidate.key}-adt-uri`,
        `The URI ADT itself returned for ${found.name}, which differs from every template above — so the difference gets measured rather than assumed away.`,
        [found.uri],
      );
      if (result) {
        outcome.adtUriAttempt = {
          uri: found.uri,
          step: result.run.step,
          status: result.run.status,
        };
      }
    }
  }

  // --- 3b. A known-bad object, if one was named -----------------------------
  // FINDING_STATS can only be decoded from a run that found something. Every
  // representative above was picked for its TYPE, not for being dirty, so they
  // may all be clean — and three zeroes look the same in any severity order.
  if (args.knownBadType && args.knownBadName) {
    const candidate = CANDIDATES.find((c) => c.key === args.knownBadType);
    if (!candidate) {
      logger.error(
        `--known-bad names an unknown type "${args.knownBadType}". Known: ${CANDIDATES.map((c) => c.key).join(', ')}`,
      );
    } else {
      const encoded = encodeURIComponent(args.knownBadName).toUpperCase();
      const uri = candidate.templates[0].build(encoded);

      // **clientWait=true, and that is the point.** `clientWait=false` answers
      // 201 with an EMPTY body — no FINDING_STATS at all — so running the
      // known-bad object that way could only ever show findings in a worklist,
      // never the triple whose positions this flag exists to decode. Only the
      // waiting mode returns `<atcworklist:worklistRun>` with the counts, and
      // it has to be THIS object: a clean one gives 0,0,0, which reads the
      // same in any severity order. Raised in review, 2026-08-16.
      const knownBadWorklist = await newWorklist('known-bad');
      if (knownBadWorklist) {
        await rec.call(
          'run-known-bad-clientWait-true',
          `An object expected to FAIL its checks (${args.knownBadName}), run in the waiting mode — the only one that answers with FINDING_STATS.`,
          {
            method: 'POST',
            url: `${ATC}/runs?worklistId=${encodeURIComponent(knownBadWorklist)}&clientWait=true`,
            headers: {
              'Content-Type': CT_ATC_RUN,
              Accept: ACCEPT_ATC_RUN_RESPONSE,
            },
            body: runBody([uri], 100),
          },
        );
        await rec.call(
          'findings-known-bad',
          'The worklist for that same run: the findings whose priorities the triple has to be read against.',
          {
            method: 'GET',
            url: `${ATC}/worklists/${encodeURIComponent(knownBadWorklist)}?includeExemptedFindings=false`,
            headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
          },
        );
      }
    }
  } else {
    logger.warn(
      'No --known-bad given: if every representative is clean, FINDING_STATS will read 0,0,0 everywhere and the positions stay undecoded.',
    );
  }

  // --- 4. The control: a URI that cannot exist ------------------------------
  // Read back, exactly like a candidate. Without the read the control cannot do
  // its job: if the bogus POST and a real one both answer 200, only the two
  // worklists tell "ATC checked this object" apart from "ATC accepted anything
  // and checked nothing". The comparison IS the control.
  await runAt(
    'control-bogus-uri',
    'Does ATC reject a URI that cannot exist? Compare this worklist against a candidate\'s: if they are indistinguishable, "the run was accepted" is not evidence of anything.',
    ['/sap/bc/adt/oo/classes/ZZ_NO_SUCH_CLASS_PROBE'],
  );

  // --- 5. Whether a run has an id of its own -------------------------------
  // Gated behind the multi-object run until 2026-08-16, which meant the one
  // session that DID receive a Location never followed it: the trial had a
  // single measurable type, so the whole branch was skipped and the probe
  // reported nothing about the very claim it exists to settle. A run id
  // question must not depend on how many object types a package happens to
  // hold.
  const attemptedUris = outcomes
    .filter((o) => o.attempted && o.attempts.length > 0)
    .map((o) => o.attempts[0].uri);

  const anyRun = acceptedRuns[0];
  if (anyRun) {
    const location =
      header(anyRun.run.headers, 'location') ??
      header(anyRun.run.headers, 'content-location');
    if (location) {
      const runId = location.split('/').filter(Boolean).pop() ?? location;
      const runUrl = location.startsWith('/')
        ? location
        : `${ATC}/runs/${encodeURIComponent(runId)}`;
      logger.info(
        `Run response carried Location: ${location} (worklist was ${anyRun.worklistId})`,
      );
      await rec.call(
        'run-status-by-location-id',
        `#68 builds its polling on a run id from Location. This fetches THAT id (${runId}), which is the only thing that can confirm or refute a status resource.`,
        {
          method: 'GET',
          url: runUrl,
          headers: { Accept: ACCEPT_ATC_RUN_STATUS },
        },
      );
      await rec.call(
        'run-status-by-location-id-longpolling-after-finish',
        'The same resource with withLongPolling=true, on a run that has already finished — where it cannot act. Kept for the comparison, not as the answer.',
        {
          method: 'GET',
          url: `${runUrl}?withLongPolling=true`,
          headers: { Accept: ACCEPT_ATC_RUN_STATUS },
        },
      );

      // The question is what long polling does while a run is IN FLIGHT: does
      // the server hold the request until the run finishes, or answer at once
      // with a running status? Asking a finished run answers neither, and
      // every earlier capture was of a finished run. So: start a fresh run and
      // ask immediately, before waiting for anything. Raised in review,
      // 2026-08-16.
      const inFlight = await newWorklist('longpolling-in-flight');
      if (inFlight) {
        const started = await rec.call(
          'run-for-longpolling-in-flight',
          'A run started only so its status can be asked while it is still running.',
          {
            method: 'POST',
            url: `${ATC}/runs?worklistId=${encodeURIComponent(inFlight)}&clientWait=false`,
            headers: {
              'Content-Type': CT_ATC_RUN,
              Accept: ACCEPT_ATC_RUN_RESPONSE,
            },
            body: runBody(
              attemptedUris.length ? attemptedUris : [anyRun.worklistId],
              100,
            ),
          },
        );
        const freshLocation =
          header(started.headers, 'location') ??
          header(started.headers, 'content-location');
        if (freshLocation) {
          const freshUrl = freshLocation.startsWith('/')
            ? freshLocation
            : `${ATC}/runs/${encodeURIComponent(freshLocation)}`;
          // Both at once, deliberately. Issued in sequence, the plain read
          // would start only after the long poll returned — by which time the
          // run may have finished either because the server held the request
          // or because it simply ended, and the two are indistinguishable.
          // Started together, the durations answer it: a long poll that
          // blocked takes materially longer than the plain read beside it.
          // Raised in review, 2026-08-16.
          const [polled, plain] = await Promise.all([
            rec.call(
              'run-status-in-flight-longpolling',
              'withLongPolling=true, asked with no delay after starting the run. Whether it BLOCKS is read from its duration against the plain read issued at the same moment.',
              {
                method: 'GET',
                url: `${freshUrl}?withLongPolling=true`,
                headers: { Accept: ACCEPT_ATC_RUN_STATUS },
              },
            ),
            rec.call(
              'run-status-in-flight-plain',
              'The same resource without long polling, started at the same moment. The control the previous step needs to mean anything.',
              {
                method: 'GET',
                url: freshUrl,
                headers: { Accept: ACCEPT_ATC_RUN_STATUS },
              },
            ),
          ]);
          logger.info(
            `long polling took ${polled.durationMs}ms; the plain read beside it took ${plain.durationMs}ms — ${
              polled.durationMs > plain.durationMs * 3
                ? 'the server appears to have HELD the request'
                : 'no evidence of blocking'
            }`,
          );
        } else {
          logger.warn(
            'The in-flight run carried no Location, so long polling could not be asked about it.',
          );
        }
      }
    } else {
      logger.info(
        'Run response carried no Location header — recorded, and the run-id claim fails here rather than at a 404.',
      );
    }

    // Separately: the worklist id, which the recorded session says the run
    // echoes. A 404 here is only about this id.
    await rec.call(
      'run-status-by-worklist-id',
      'A different question from the one above: is the worklist id usable as a run id?',
      {
        method: 'GET',
        url: `${ATC}/runs/${encodeURIComponent(anyRun.worklistId)}`,
        headers: { Accept: ACCEPT_ATC_RUN_STATUS },
      },
    );

    await rec.call(
      'findings-exempted-true',
      'Does includeExemptedFindings=true exist at all? It stays out of the contract until this answers.',
      {
        method: 'GET',
        url: `${ATC}/worklists/${encodeURIComponent(anyRun.worklistId)}?includeExemptedFindings=true`,
        headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
      },
    );
    await rec.call(
      'findings-checkstyle',
      'The recorded session says checkstyle is answered with 406 and one accepted type. Confirm or refute.',
      {
        method: 'GET',
        url: `${ATC}/worklists/${encodeURIComponent(anyRun.worklistId)}`,
        headers: { Accept: ACCEPT_ATC_WORKLIST_CHECKSTYLE },
      },
    );
  } else {
    logger.warn(
      'No run was accepted at all — nothing to ask about run ids or worklist reads.',
    );
  }

  // --- 5b. Plural references, which is the shape the contract promises -----
  if (attemptedUris.length > 1) {
    await runAt(
      'multiple-objects',
      'IAtcRunTarget takes a set. Does one run accept several object references?',
      attemptedUris,
    );
  } else {
    logger.warn(
      "Fewer than two URIs to work with — skipping the multi-object run. IAtcRunTarget's plural shape stays unconfirmed.",
    );
  }

  // --- 6. maximumVerdicts at its edges, and clientWait ----------------------
  const anyUri = attemptedUris[0];
  if (anyUri) {
    for (const verdicts of [0, 1, 100000]) {
      await runAt(
        `maximumVerdicts-${verdicts}`,
        'The server bounds on maximumVerdicts, which nothing states. Decides whether run() should validate a range.',
        [anyUri],
        { readBack: false, maximumVerdicts: verdicts },
      );
    }

    const waitWorklist = await newWorklist('clientwait');
    if (waitWorklist) {
      await rec.call(
        'run-clientWait-true',
        'Does the server hold the request until the run finishes? If it does, waiting is answered by removing the question.',
        {
          method: 'POST',
          url: `${ATC}/runs?worklistId=${encodeURIComponent(waitWorklist)}&clientWait=true`,
          headers: {
            'Content-Type': CT_ATC_RUN,
            Accept: ACCEPT_ATC_RUN_RESPONSE,
          },
          body: runBody([anyUri], 100),
        },
      );
    }
  }

  // --- 7. Extras, only when asked ------------------------------------------
  if (args.extras) {
    const candidateCodes = new Set(CANDIDATES.flatMap((c) => c.typeCodes));
    for (const [code, item] of firstOfType) {
      if (candidateCodes.has(code) || !item.uri) continue;
      await runAt(
        `extra-${code.replace(/[^a-z0-9]+/gi, '-')}`,
        `Not a candidate type — probed because --extras was passed. ${item.name}, at ADT's own URI.`,
        [item.uri],
        { readBack: false },
      );
    }
  }

  // --- The verdict, stated rather than left to be inferred -----------------
  const scopeOf = (key: string) =>
    CANDIDATES.find((c) => c.key === key)?.scope ?? 'cloud';
  const why = (o: ICandidateOutcome) =>
    o.reason ??
    (o.finished
      ? `finished, worklist listed [${(o.objectsListed ?? []).map((x) => `${x.type}:${x.name}`).join(', ') || 'nothing'}]`
      : o.attempted
        ? 'run never reported finished'
        : 'never asked');

  // Only cloud-scope candidates can be decided here. A classic program cannot
  // exist on ABAP Cloud, so counting it against this run would leave the probe
  // permanently INCOMPLETE and say nothing about the system. Raised in review,
  // 2026-08-16.
  const cloudCandidates = outcomes.filter((o) => scopeOf(o.key) === 'cloud');
  const onpremCandidates = outcomes.filter((o) => scopeOf(o.key) === 'onprem');
  const confirmed = cloudCandidates.filter((o) => o.confirmed);
  const unconfirmed = cloudCandidates.filter((o) => !o.confirmed);
  const verdict = unconfirmed.length
    ? `INCOMPLETE — ${confirmed.length} of ${cloudCandidates.length} cloud candidate types CONFIRMED; unconfirmed: ${unconfirmed.map((o) => `${o.key} [${why(o)}]`).join(', ')}`
    : `COMPLETE — all ${cloudCandidates.length} cloud candidate types confirmed`;

  // A non-zero triple somewhere is what makes the positions readable at all.
  const nonZeroStats = rec.findingStats.filter(
    (f) => f.triple && !/^0\s*,\s*0\s*,\s*0$/.test(f.triple),
  );
  const findingStatsVerdict =
    rec.findingStats.length === 0
      ? "FINDING_STATS never appeared in any run response — the spec's premise for it is unconfirmed here"
      : nonZeroStats.length === 0
        ? 'FINDING_STATS seen but always zero — the positions remain undecoded; re-run with --known-bad=KEY:NAME'
        : `FINDING_STATS non-zero in ${nonZeroStats.length} run(s) — the positions can be read from those`;

  rec.flush({
    system: sapConfig.url,
    checkVariant,
    checkVariantVerb: variantFromGet ? 'GET' : 'POST',
    packageName,
    verdict,
    findingStatsVerdict,
    findingStatsSeen: rec.findingStats,
    candidates: outcomes,
  });

  // Not part of the exit code: the spec keeps FINDING_STATS off the blocking
  // list on purpose, since the contract returns the triple verbatim. It is
  // still said out loud, because a silent zero is how it would go unnoticed.
  if (nonZeroStats.length === 0) {
    logger.warn(findingStatsVerdict);
  } else {
    logger.info(findingStatsVerdict);
  }

  if (unconfirmed.length) {
    logger.error(verdict);
    logger.error(
      'AtcObjectType is NOT closed by this run. A type joins the union when a FINISHED worklist lists its object — not when a run is accepted, which happens for a URI that cannot exist.',
    );
    for (const o of unconfirmed) {
      logger.error(`  ${o.key}: ${why(o)}`);
    }
    process.exitCode = 1;
  } else {
    logger.info(verdict);
  }

  // Reported, never counted: this system cannot hold these, so nothing here
  // decides them either way. They widen the union from an on-prem probe.
  for (const o of onpremCandidates) {
    logger.info(
      `on-prem only — ${o.key}: ${why(o)} (not counted against this run)`,
    );
  }
  logger.info(`Evidence written to ${outDir}`);
}

main().catch((error) => {
  // No logger here by design: this is the path where the probe itself broke,
  // and the process must exit non-zero with the reason visible.
  process.stderr.write(`probe-atc failed: ${String(error)}\n`);
  process.exitCode = 1;
});
