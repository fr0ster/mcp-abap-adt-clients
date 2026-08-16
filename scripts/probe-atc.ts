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
 *     candidate with no representative object is reported as **unmeasured**
 *     with a non-zero exit. A probe that quietly checked four types and exited
 *     0 would leave the blocker open while looking like it had closed it.
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
 * Exit code is **1 when any candidate went unmeasured**, so an incomplete probe
 * cannot be mistaken for a finished one.
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
  templates: ITemplate[];
  /** Whether #68 maps this type at all. */
  mappedBy68: boolean;
}

const CANDIDATES: ICandidate[] = [
  {
    key: 'class',
    typeCodes: ['CLAS/OC'],
    templates: [
      { label: 'oo/classes', build: (n) => `/sap/bc/adt/oo/classes/${n}` },
    ],
    mappedBy68: true,
  },
  {
    key: 'interface',
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
    typeCodes: ['DEVC/K', 'DEVC'],
    templates: [
      { label: 'packages', build: (n) => `/sap/bc/adt/packages/${n}` },
    ],
    mappedBy68: true,
  },
  {
    key: 'ddl_source',
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
    typeCodes: ['TABL/DT'],
    templates: [
      { label: 'ddic/tables', build: (n) => `/sap/bc/adt/ddic/tables/${n}` },
    ],
    mappedBy68: false,
  },
  {
    key: 'behavior_definition',
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
}

class Recorder {
  private readonly steps: IStep[] = [];
  private n = 0;

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
    };
    this.logger.info(`[${n}] ${step} — ${req.method} ${req.url}`);

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

    const file = `${String(n).padStart(2, '0')}-${step.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    fs.writeFileSync(path.join(this.outDir, file), body, 'utf8');
    record.bodyFile = file;
    record.bodyPreview = body.slice(0, 400);
    this.steps.push(record);
    this.logger.info(
      `[${n}] → ${record.status ?? 'no status'}, ${body.length} bytes → ${file}`,
    );
    return { status: record.status, body, headers, step: n };
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
   * Whether an answer was obtained — **not** whether ATC accepted the type. A
   * run rejected with 400 is measured: the rejection is the finding. Only "no
   * representative object, so nothing was asked" counts as unmeasured, because
   * that is the state that would leave `AtcObjectType` open while the probe
   * exited looking finished.
   */
  measured: boolean;
  /** Why it went unmeasured, in the manifest rather than only in the log. */
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

  /**
   * Every FINDING_STATS this session saw. Collected because the triple's
   * positions can only be decoded from a run that found something: `0,0,0`
   * looks identical whichever order the severities are in.
   */
  const findingStatsSeen: {
    step: number;
    label: string;
    triple: string | null;
    context: string;
  }[] = [];

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

  /** Start a run and read the worklist afterwards. Returns the run's own result. */
  const runAt = async (
    label: string,
    answers: string,
    uris: string[],
    options?: { readBack?: boolean; maximumVerdicts?: number },
  ): Promise<{ run: ICallResult; worklistId: string } | null> => {
    const worklistId = await newWorklist(label);
    if (!worklistId) return null;
    const run = await rec.call(`run-${label}`, answers, {
      method: 'POST',
      url: `${ATC}/runs?worklistId=${encodeURIComponent(worklistId)}&clientWait=false`,
      headers: { 'Content-Type': CT_ATC_RUN, Accept: ACCEPT_ATC_RUN_RESPONSE },
      body: runBody(uris, options?.maximumVerdicts ?? 100),
    });
    const stats = parseFindingStats(run.body);
    if (stats) {
      findingStatsSeen.push({
        step: run.step,
        label,
        triple: stats.triple,
        context: stats.context,
      });
    }
    if (options?.readBack !== false) {
      await rec.call(
        `findings-${label}`,
        'What the worklist holds after that run — including whether an accepted type produced anything.',
        {
          method: 'GET',
          url: `${ATC}/worklists/${encodeURIComponent(worklistId)}?includeExemptedFindings=false`,
          headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
        },
      );
    }
    return { run, worklistId };
  };

  // --- 3. The blocker, measured against the required list ------------------
  for (const candidate of CANDIDATES) {
    const outcome: ICandidateOutcome = {
      key: candidate.key,
      mappedBy68: candidate.mappedBy68,
      representative: null,
      attempts: [],
      measured: false,
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
      if (result) outcome.measured = true;
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
      await runAt(
        'known-bad',
        `An object expected to FAIL its checks (${args.knownBadName}). The only run that can say what the FINDING_STATS positions mean.`,
        [uri],
      );
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

  // --- 5. Plural references, and whether a run has an id of its own ---------
  const measuredUris = outcomes
    .filter((o) => o.measured && o.attempts.length > 0)
    .map((o) => o.attempts[0].uri);

  if (measuredUris.length > 1) {
    const multi = await runAt(
      'multiple-objects',
      'IAtcRunTarget takes a set. Does one run accept several object references?',
      measuredUris,
      { readBack: false },
    );
    if (multi) {
      // The disputed claim is #68's separate run id from `Location`. Read the
      // header first; a 404 for the worklist id would say nothing about it.
      const location =
        header(multi.run.headers, 'location') ??
        header(multi.run.headers, 'content-location');
      if (location) {
        const runId = location.split('/').filter(Boolean).pop() ?? location;
        logger.info(`Run response carried Location: ${location}`);
        await rec.call(
          'run-status-by-location-id',
          `#68 builds its polling on a run id from Location. This fetches THAT id (${runId}), which is the only thing that can confirm or refute a status resource.`,
          {
            method: 'GET',
            url: location.startsWith('/')
              ? location
              : `${ATC}/runs/${encodeURIComponent(runId)}`,
            headers: { Accept: ACCEPT_ATC_RUN_STATUS },
          },
        );
        await rec.call(
          'run-status-by-location-id-longpolling',
          'The same resource with withLongPolling=true, which is what #68 actually sends.',
          {
            method: 'GET',
            url: `${location.startsWith('/') ? location : `${ATC}/runs/${encodeURIComponent(runId)}`}?withLongPolling=true`,
            headers: { Accept: ACCEPT_ATC_RUN_STATUS },
          },
        );
      } else {
        logger.info(
          'Run response carried no Location header — recorded, and the run-id claim fails here rather than at a 404.',
        );
      }

      // Separately: the worklist id, which the spec says the run echoes.
      await rec.call(
        'run-status-by-worklist-id',
        'A different question from the one above: is the worklist id usable as a run id? A 404 here is only about this id.',
        {
          method: 'GET',
          url: `${ATC}/runs/${encodeURIComponent(multi.worklistId)}`,
          headers: { Accept: ACCEPT_ATC_RUN_STATUS },
        },
      );

      await rec.call(
        'findings-multi-exempted-true',
        'Does includeExemptedFindings=true exist at all? It stays out of the contract until this answers.',
        {
          method: 'GET',
          url: `${ATC}/worklists/${encodeURIComponent(multi.worklistId)}?includeExemptedFindings=true`,
          headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
        },
      );
      await rec.call(
        'findings-checkstyle',
        'The spec says checkstyle is answered with 406 and one accepted type. Confirm or refute.',
        {
          method: 'GET',
          url: `${ATC}/worklists/${encodeURIComponent(multi.worklistId)}`,
          headers: { Accept: ACCEPT_ATC_WORKLIST_CHECKSTYLE },
        },
      );
    }
  } else {
    logger.warn(
      'Fewer than two measured URIs — skipping the multi-object run and everything that reads its worklist.',
    );
  }

  // --- 6. maximumVerdicts at its edges, and clientWait ----------------------
  const anyUri = measuredUris[0];
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
  const unmeasured = outcomes.filter((o) => !o.measured);
  const verdict = unmeasured.length
    ? `INCOMPLETE — ${unmeasured.length} of ${CANDIDATES.length} candidate types unmeasured: ${unmeasured.map((o) => o.key).join(', ')}`
    : `COMPLETE — all ${CANDIDATES.length} candidate types measured`;

  // A non-zero triple somewhere is what makes the positions readable at all.
  const nonZeroStats = findingStatsSeen.filter(
    (f) => f.triple && !/^0\s*,\s*0\s*,\s*0$/.test(f.triple),
  );
  const findingStatsVerdict =
    findingStatsSeen.length === 0
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
    findingStatsSeen,
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

  if (unmeasured.length) {
    logger.error(verdict);
    logger.error(
      'AtcObjectType is NOT closed by this run. Point --package at a package holding the missing types, or probe them individually.',
    );
    for (const o of unmeasured) {
      logger.error(`  ${o.key}: ${o.reason ?? 'no run completed'}`);
    }
    process.exitCode = 1;
  } else {
    logger.info(verdict);
  }
  logger.info(`Evidence written to ${outDir}`);
}

main().catch((error) => {
  // No logger here by design: this is the path where the probe itself broke,
  // and the process must exit non-zero with the reason visible.
  process.stderr.write(`probe-atc failed: ${String(error)}\n`);
  process.exitCode = 1;
});
