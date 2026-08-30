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
 *   --variant=NAME   check variant to run under, overriding the system's
 *                    `systemCheckVariant`. The variant decides whether anything
 *                    is found, and a worklist lists only objects that produced
 *                    findings — so a variant that finds nothing leaves every
 *                    type unconfirmed for a reason that has nothing to do with
 *                    the URI templates under test.
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
 *   --require=KEYS   comma-separated candidate keys this run must confirm, or
 *                    `all`. **Every candidate is probed either way** — this
 *                    decides only what the VERDICT counts. Omitted on a cloud
 *                    system it defaults to the cloud-scope types; omitted on
 *                    anything else the probe exits non-zero and says so,
 *                    because it does not know which types that system holds.
 *
 * Exit code is **1 unless every required candidate is confirmed**, so an
 * incomplete probe cannot be mistaken for a finished one. On an on-prem run
 * that means `--require` is not optional: without it the run cannot decide
 * `program` and `include`, which are the two types an on-prem probe exists to
 * settle.
 *
 * Writes `DIR/manifest.json` (every step, plus the verdict, machine-readable)
 * and one raw body file per step. Read the raw files — the manifest is an index,
 * not a summary.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  type IAbapConnection,
  type ILogger,
  LogLevel,
} from '@mcp-abap-adt/interfaces';
import { DefaultLogger } from '@mcp-abap-adt/logger';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  getConfig,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { refuseWhileRunOwnsSession } from '../src/__tests__/helpers/sharedSession';
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

export const CANDIDATES: ICandidate[] = [
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
  const require = get('require');
  return {
    packageName: get('package'),
    /**
     * Override the check variant the system nominates.
     *
     * Normally the variant comes from `systemCheckVariant` in
     * `/atc/customizing`, which is the one Eclipse uses and so the right
     * default. But the variant decides whether anything is *found*, and a
     * worklist only lists objects that produced findings — so on a system whose
     * nominated variant finds nothing, or aborts, every candidate reads
     * "finished → [nothing]" and the type question cannot be settled at all.
     * Measured on E19, 2026-08-28: `Z_ATC_TEST` aborts every run with
     * `TOOL_FAILURE: ATC check run aborted, due to missing prerequisites`.
     */
    variant: get('variant'),
    outDir: get('out') ?? 'atc-probe',
    extras: argv.includes('--extras'),
    knownBadType,
    knownBadName,
    /**
     * Which candidate keys this run must confirm, or undefined when the caller
     * did not say. Undefined is not the same as "the default set": it is the
     * state in which this probe refuses to report a clean pass on a system it
     * was not written for. See `requiredKeysFor`.
     */
    require:
      require === undefined
        ? undefined
        : require === 'all'
          ? CANDIDATES.map((c) => c.key)
          : require
              .split(',')
              .map((k) => k.trim())
              .filter(Boolean),
  };
}

/** Parse, then reject a bad key before anything connects. */
function parseArgsChecked(argv: string[]) {
  const args = parseArgs(argv);
  if (args.require) assertKnownKeys(args.require);
  return args;
}

/**
 * Host suffixes that only ABAP Cloud uses. Deliberately short.
 *
 * A name missing from this list costs one `--require` flag. A name wrongly on
 * it costs a false COMPLETE, which is the failure this whole file is about, so
 * the list only grows against a system somebody has actually seen.
 */
const CLOUD_HOST_SUFFIXES = ['.hana.ondemand.com', '.abap.cloud.sap'];

/**
 * Whether the base URL *proves* this is ABAP Cloud.
 *
 * Not `isCloudEnvironment()`, and the difference is the point. That helper
 * falls back to "does `/sap/bc/adt/core/http/systeminformation` answer" — an
 * endpoint a **modern on-prem serves too**. Using it here would let a 7.5x
 * system be taken for cloud, apply the cloud-only default, and hand back
 * `COMPLETE` with `program` and `include` uncounted: exactly the bug this file
 * was changed to remove, reintroduced through the detector.
 *
 * The asymmetry is deliberate. Refusing on a false negative costs one flag;
 * passing on a false positive costs a wrong answer that reads like a right one.
 * So the permissive branch demands proof, and everything else — an unknown
 * host, an unparseable URL, no URL at all — asks the caller to say what they
 * require.
 */
export function looksUnambiguouslyCloud(baseUrl: string | undefined): boolean {
  if (!baseUrl) return false;
  let host: string;
  try {
    host = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  // Suffix on a host boundary, not `includes`: `ondemand.com.example.org` is
  // somebody else's domain, and a substring test would hand it the cloud path.
  return CLOUD_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Reject a candidate key nobody defines, naming the ones that exist.
 *
 * Called at argument-parse time as well as from `requiredKeysFor`, so a typo
 * costs nothing: on an on-prem system the alternative is connecting, probing,
 * and only then being told the flag was misspelled — and an on-prem session is
 * not cheap to repeat.
 */
export function assertKnownKeys(keys: string[]): void {
  // `--require=` and `--require=,,,` both survive split/trim/filter as an empty
  // array, which is truthy, so it read as an explicit statement — and a run
  // required to confirm nothing confirms it, exits 0 and decides nothing. A
  // caller who passes the flag means to name something.
  if (keys.length === 0) {
    throw new Error(
      `--require was given with no candidate in it. Name at least one, or pass --require=all. Known: ${CANDIDATES.map((c) => c.key).join(', ')}`,
    );
  }
  const unknown = keys.filter((k) => !CANDIDATES.some((c) => c.key === k));
  if (unknown.length) {
    throw new Error(
      `--require names ${unknown.join(', ')}, which ${unknown.length === 1 ? 'is not a candidate' : 'are not candidates'}. Known: ${CANDIDATES.map((c) => c.key).join(', ')}`,
    );
  }
}

/**
 * The candidate keys a run is judged on, and the reason for the choice.
 *
 * The verdict used to count cloud-scope candidates and nothing else. On the
 * trial that was right — a classic program cannot exist on ABAP Cloud, and
 * counting it would have left the probe permanently INCOMPLETE. Run on an
 * **on-prem** system it became a trap: `program` and `include` were probed,
 * reported on a line of their own, and then left out of the verdict, so the
 * probe printed `COMPLETE` and exited 0 on exactly the run whose purpose was
 * to settle them.
 *
 * The fix is not to infer the set from the system. **The caller states what
 * must be confirmed**, and `isCloud` here means *proven* cloud — see
 * `looksUnambiguouslyCloud`, and note that the first attempt at this used
 * `isCloudEnvironment()`, whose endpoint fallback a modern on-prem also
 * answers, which let the trap back in through the detector.
 */
export function requiredKeysFor(
  explicit: string[] | undefined,
  isCloud: boolean,
  logger: ILogger,
): { keys: string[]; source: string; refuse: boolean } {
  if (explicit) {
    assertKnownKeys(explicit);
    return { keys: explicit, source: '--require', refuse: false };
  }

  const cloudKeys = CANDIDATES.filter((c) => c.scope === 'cloud').map(
    (c) => c.key,
  );

  if (isCloud) {
    return {
      keys: cloudKeys,
      source: 'default for a cloud system',
      refuse: false,
    };
  }

  // Not cloud, and nobody said what to require. The honest answer is that this
  // probe does not know which types this system can hold — a 7.40 on-prem has
  // no behaviour definitions, a 7.5x has both those and classic programs — and
  // guessing produces either a false COMPLETE or a permanent INCOMPLETE.
  logger.error(
    'The base URL does not prove this is ABAP Cloud, and --require was not given. It may well be a cloud system under a host this probe does not recognise — that is precisely why it will not decide for you.',
  );
  logger.error(
    `Say what this run must confirm, e.g. --require=${[...cloudKeys, 'program', 'include'].join(',')} on a modern on-prem, or --require=all. Every candidate is probed either way; --require decides what the VERDICT counts.`,
  );
  return { keys: cloudKeys, source: 'none given', refuse: true };
}

/**
 * The exit code, as a value rather than a side effect.
 *
 * Split out because the first version of the refusal was unreachable from a
 * test: `requiredKeysFor` returned `refuse: true` and `main` acted on it, so
 * deleting the line that set the exit code broke nothing that anyone checked.
 * A verdict nobody can act on is the same failure as a verdict that lies —
 * whatever the log says, `$?` is what a caller and a CI job read.
 */
export function exitCodeFor(opts: {
  unconfirmed: number;
  refuse: boolean;
}): 0 | 1 {
  return opts.unconfirmed > 0 || opts.refuse ? 1 : 0;
}

/**
 * The verdict line — the one written into `manifest.json` and read by people.
 *
 * Pure and tested for the same reason `exitCodeFor` is, and it was missed the
 * first time: the exit code became a value while this stayed inline, so a run
 * that refused to judge still wrote `COMPLETE` into the manifest and logged it.
 * The exit code was 1, but `$?` does not survive into an artefact — the string
 * does, and a reader or a consumer of the manifest takes it at its word.
 *
 * So refusal is a verdict of its own, not a footnote under a good one.
 */
export function verdictFor(opts: {
  requiredKeys: string[];
  source: string;
  confirmed: number;
  unconfirmed: { key: string; why: string }[];
  refuse: boolean;
}): string {
  const countedAs = `${opts.requiredKeys.length} required type(s) [${opts.requiredKeys.join(', ')}] — set from ${opts.source}`;
  const unconfirmed = opts.unconfirmed.length
    ? `; unconfirmed: ${opts.unconfirmed.map((o) => `${o.key} [${o.why}]`).join(', ')}`
    : '';

  if (opts.refuse) {
    return `REFUSED — this run did not say what it must confirm, and this system is not one whose type inventory the probe knows. ${opts.confirmed} of ${countedAs} confirmed${unconfirmed}. Nothing here decides the on-prem-only types; re-run with --require.`;
  }

  return opts.unconfirmed.length
    ? `INCOMPLETE — ${opts.confirmed} of ${countedAs}${unconfirmed}`
    : `COMPLETE — all of ${countedAs}`;
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
  /**
   * Every URI tried for it, with what that particular attempt established.
   *
   * Per attempt, not per candidate: `include` is run at two different
   * templates, and aggregating would say the type is confirmed without saying
   * WHICH mapping confirmed it — which is the only thing anyone wants to know
   * about include. Raised in review, 2026-08-16.
   */
  attempts: {
    template: string;
    uri: string;
    step: number;
    status: number | null;
    finished: boolean;
    objectsListed: { type: string; name: string }[];
    confirmed: boolean;
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
  /** Which template's run produced the confirmation, where one did. */
  confirmedBy?: string;
  /**
   * ATC checked an object of this type in SOME finished worklist — typically
   * the package run, which lists everything in the package.
   *
   * A weaker fact than `confirmed`, and deliberately separate. It says the
   * type is checkable; it does NOT say the URI this client builds for it is
   * the right one to submit, which is what `AtcObjectType` promises. Both
   * matter and they are not the same claim.
   */
  seenCheckedInSomeWorklist?: { worklistOf: string; name: string };
  /** Why it was never asked, in the manifest rather than only in the log. */
  reason?: string;
}

async function main(): Promise<void> {
  refuseWhileRunOwnsSession();

  // A probe that says nothing while it works is unusable; INFO regardless of
  // the DEBUG_* flags, which gate the library's own loggers.
  const logger: ILogger = new DefaultLogger(LogLevel.INFO);
  const args = parseArgsChecked(process.argv.slice(2));

  const outDir = path.resolve(process.cwd(), args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const sapConfig = getConfig();
  const connection = await createTestConnection(createConnectionLogger());
  try {
    await connection.connect();
    logger.info(`Connected to ${sapConfig.url}`);

    // Read from the URL, not from an endpoint: see `looksUnambiguouslyCloud`.
    // Anything short of proof errs towards demanding --require.
    let isCloud = false;
    try {
      isCloud = looksUnambiguouslyCloud(await connection.getBaseUrl());
    } catch (error) {
      logger.warn(
        `Could not read the base URL (${String(error)}) — treating this as not provably cloud, which asks for --require rather than assuming.`,
      );
    }
    const required = requiredKeysFor(args.require, isCloud, logger);
    logger.info(
      `Judged on: ${required.keys.join(', ')} (${required.source}); host ${isCloud ? 'is provably ABAP Cloud' : 'is NOT provably ABAP Cloud'}.`,
    );

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
    const nominatedVariant =
      variantFromGet ?? parseSystemCheckVariant(customizingPost.body);
    const checkVariant = args.variant ?? nominatedVariant;
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
      args.variant
        ? `Check variant: ${checkVariant} (--variant; the system nominates ${nominatedVariant ?? 'none'})`
        : `Check variant: ${checkVariant} (from ${variantFromGet ? 'GET' : 'POST'} /atc/customizing)`,
    );

    // --- 2. Representative objects for the required candidate list ------------
    const packageName =
      args.packageName ?? defaultPackageFromTestConfig(logger);
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

    const readContents = async () => {
      const items = await utils.getPackageContentsList(packageName, {
        includeSubpackages: true,
      });
      const map = new Map<
        string,
        { name: string; type: string; uri?: string }
      >();
      for (const item of items) {
        if (!map.has(item.type)) {
          map.set(item.type, {
            name: item.name,
            type: item.type,
            uri: item.uri,
          });
        }
      }
      return map;
    };

    /**
     * Every object any finished worklist named, and which run's it was.
     *
     * The package run lists the whole package, so it can show ATC checking a
     * type whose own run never happened — which is how a run of 2026-08-17
     * proved FUGR and DDLS checkable while the probe reported them "never
     * asked". Recorded separately from per-candidate confirmation, because it
     * proves a different thing.
     */
    const everChecked: { worklistOf: string; type: string; name: string }[] =
      [];

    let firstOfType = await readContents();
    // Say what was found. The probe used to read the package silently and then
    // report "no object of X" — which reads as a fact about the package when it
    // may be a fact about one listing call. A run of 2026-08-17 reported FUGR/F
    // and DDLS/DF absent while three listings before and after returned both.
    logger.info(
      `${packageName} listing: ${[...firstOfType.values()].map((v) => `${v.type}:${v.name}`).join(', ') || '(nothing)'}`,
    );

    const missingCloud = () =>
      CANDIDATES.filter(
        (c) =>
          c.scope === 'cloud' && !c.typeCodes.some((t) => firstOfType.has(t)),
      ).map((c) => c.key);

    if (missingCloud().length) {
      logger.warn(
        `Listing has no representative for: ${missingCloud().join(', ')} — reading it again before believing that.`,
      );
      const second = await readContents();
      logger.info(
        `${packageName} listing (2nd): ${[...second.values()].map((v) => `${v.type}:${v.name}`).join(', ') || '(nothing)'}`,
      );
      if (second.size > firstOfType.size) {
        logger.warn(
          'The second listing returned MORE than the first — the package listing is not reliable in this session, and the larger one is used.',
        );
        firstOfType = second;
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
        headers: {
          'Content-Type': CT_ATC_RUN,
          Accept: ACCEPT_ATC_RUN_RESPONSE,
        },
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
        if (finished) {
          objects = objectsIn(findings.body);
          for (const o of objects) {
            everChecked.push({ worklistOf: label, type: o.type, name: o.name });
          }
        }
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
        // The evidence rule: the finished worklist lists an object of THIS type
        // under THIS name. Both halves, for the reason in objectsIn.
        const listed =
          result?.finished === true &&
          result.objects.some(
            (o) =>
              o.name.toUpperCase() === found.name.toUpperCase() &&
              o.type.toUpperCase() === candidate.worklistTypeCode,
          );

        outcome.attempts.push({
          template: template.label,
          uri,
          step: result?.run.step ?? -1,
          status: result?.run.status ?? null,
          finished: result?.finished ?? false,
          objectsListed: result?.objects ?? [],
          confirmed: listed,
        });

        if (result) {
          outcome.attempted = true;
          if (result.finished) outcome.finished = true;
          if (listed) {
            outcome.confirmed = true;
            // The template that did it, so the manifest names the mapping rather
            // than only the verdict.
            outcome.confirmedBy = template.label;
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

    // Cross-reference: a type whose own run never happened may still have been
    // checked in somebody else's worklist. Weaker evidence, recorded as such.
    for (const outcome of outcomes) {
      if (outcome.confirmed) continue;
      const candidate = CANDIDATES.find((c) => c.key === outcome.key);
      if (!candidate) continue;
      const hit = everChecked.find(
        (e) => e.type.toUpperCase() === candidate.worklistTypeCode,
      );
      if (hit) {
        outcome.seenCheckedInSomeWorklist = {
          worklistOf: hit.worklistOf,
          name: hit.name,
        };
        logger.info(
          `${outcome.key}: not confirmed at a built URI, but ATC checked ${hit.type}:${hit.name} in the ${hit.worklistOf} worklist — the TYPE is checkable, the template is still unproven.`,
        );
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

    // --- 3c. A run that should FAIL -------------------------------------------
    // "Poll until finished" has no stopping condition unless a failed run reports
    // something other than finished, and nobody has seen one. --known-bad does
    // not answer this: an object with findings still produces a run that
    // succeeds. Raised in review, 2026-08-17.
    //
    // The cheapest deliberate failure is a check variant that does not exist. It
    // may well be refused at worklist creation rather than producing a failed
    // run — in which case the question stays open, and the manifest says so
    // instead of the spec claiming a coverage it does not have.
    const bogusVariant = 'ZZ_NO_SUCH_CHECK_VARIANT_PROBE';
    const bogusWorklist = await rec.call(
      'worklist-bogus-variant',
      'A worklist against a check variant that does not exist — the cheapest way to try to produce a run that fails.',
      {
        method: 'POST',
        url: `${ATC}/worklists?checkVariant=${encodeURIComponent(bogusVariant)}`,
        headers: {
          'Content-Type': CT_ATC_WORKLIST_CREATE,
          Accept: ACCEPT_ATC_WORKLIST_ID,
        },
        body: '',
      },
    );
    const bogusWorklistId = parseWorklistId(bogusWorklist.body);
    if (!bogusWorklistId) {
      logger.warn(
        `A bogus check variant was refused at worklist creation (${bogusWorklist.status}), so no run was produced. What a FAILED run reports stays unanswered.`,
      );
    } else if (outcomes.some((o) => o.attempted && o.attempts.length > 0)) {
      const failing = await rec.call(
        'run-bogus-variant',
        'A run under a check variant that does not exist. Acceptance proves nothing on its own — the server may fall back to a real variant, or run to an end and record the problem elsewhere. What follows is sampling, not a verdict.',
        {
          method: 'POST',
          url: `${ATC}/runs?worklistId=${encodeURIComponent(bogusWorklistId)}&clientWait=false`,
          headers: {
            'Content-Type': CT_ATC_RUN,
            Accept: ACCEPT_ATC_RUN_RESPONSE,
          },
          body: runBody(
            [
              // biome-ignore lint/style/noNonNullAssertion: guarded by the some() above
              outcomes.find((o) => o.attempted && o.attempts.length > 0)!
                .attempts[0].uri,
            ],
            100,
          ),
        },
      );
      const loc =
        header(failing.headers, 'location') ??
        header(failing.headers, 'content-location');
      if (loc) {
        const url = loc.startsWith('/')
          ? loc
          : `${ATC}/runs/${encodeURIComponent(loc)}`;
        // Deliberately NOT waitForRun: that loops on anything that is not
        // `finished`, which is exactly what a failed run may be.
        //
        // And deliberately no early exit on "not running". An earlier version
        // stopped at the first status other than `running` and called it
        // terminal — which would mistake `queued`, `scheduled` or any state
        // nobody has seen for the end of the run. There is no list of
        // non-terminal states to test against; that list is what is missing.
        // Raised in review, 2026-08-17.
        //
        // So: poll to a fixed bound, record every status, and let a human read
        // the sequence. A value that repeats to the bound is a candidate
        // terminal state, not a proven one.
        const seen: string[] = [];
        // The count lives here and nowhere else: the spec describes the sequence
        // as bounded rather than naming a number, because every number this
        // session put in prose drifted from the code that produced it.
        const STATUS_SAMPLES = 8;
        for (let attempt = 1; attempt <= STATUS_SAMPLES; attempt++) {
          const st = await rec.call(
            `status-bogus-variant-${attempt}`,
            'The status of a run under a variant that does not exist, sampled to a fixed bound. The SEQUENCE is the evidence; no single value is read as terminal.',
            { method: 'GET', url, headers: { Accept: ACCEPT_ATC_RUN_STATUS } },
          );
          seen.push(
            st.body.match(/runs:status="([^"]+)"/)?.[1] ?? 'unreadable',
          );
          await new Promise((r) => setTimeout(r, RUN_POLL_DELAY_MS));
        }
        logger.info(`bogus-variant status sequence: ${seen.join(' → ')}`);

        // Independent evidence, because a bogus variant being ACCEPTED does not
        // mean the run failed: the server may fall back to a real variant, or
        // run to an end and record the problem elsewhere. Captured for
        // comparison against a healthy run — a worklist that looks ordinary is
        // not proof that nothing failed, since `finished` marks completion
        // rather than success.
        await rec.call(
          'findings-bogus-variant',
          'The worklist of the bogus-variant run, captured for comparison against a healthy one. Nothing here is classified: `finished` marks completion, not success, so a normal-looking worklist is not proof the run succeeded.',
          {
            method: 'GET',
            url: `${ATC}/worklists/${encodeURIComponent(bogusWorklistId)}?includeExemptedFindings=false`,
            headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
          },
        );
        // The run resource links to a THIRD id under /atc/results/. Two log
        // resources hang off it — the EXECUTION log at /results/{id}/log and the
        // CHECK-FAILURE logs at /atc/checkfailures/logs — and a failure could be
        // recorded in either, or in neither. Both are fetched below, the way
        // src/runtime/atc/logs.ts issues them.
        const lastStatus = await rec.call(
          'status-bogus-variant-final',
          'One more status read, to take the results link out of it — and the ninth sample of the status, which counts like the other eight.',
          { method: 'GET', url, headers: { Accept: ACCEPT_ATC_RUN_STATUS } },
        );
        const finalValue =
          lastStatus.body.match(/runs:status="([^"]+)"/)?.[1] ?? 'unreadable';

        // This read can be the FIRST to show `finished`, and the worklist above
        // was taken before it. Left alone that produces a third case the spec
        // does not describe: completion observed, but only after part of the
        // evidence was captured. So re-read the worklist here, and every capture
        // is then on the same side of the marker. Raised in review, 2026-08-17.
        const finishedOnlyNow =
          finalValue.trim().toLowerCase() === 'finished' &&
          !seen.some((v) => v.trim().toLowerCase() === 'finished');
        if (finishedOnlyNow) {
          await rec.call(
            'findings-bogus-variant-after-finished',
            'The worklist again, now that a `finished` has been seen. The earlier read predates the marker and is kept for the comparison, not as the final state.',
            {
              method: 'GET',
              url: `${ATC}/worklists/${encodeURIComponent(bogusWorklistId)}?includeExemptedFindings=false`,
              headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
            },
          );
        }
        seen.push(finalValue);

        const resultsHref = lastStatus.body.match(
          /href="([^"]*\/atc\/results\/[^"]*)"/,
        )?.[1];
        if (resultsHref) {
          await rec.call(
            'results-bogus-variant',
            'The run result resource for the bogus-variant run — one of four captures a failure could be represented in.',
            {
              method: 'GET',
              url: resultsHref,
              headers: { Accept: 'application/xml' },
            },
          );
          // The EXECUTION log — one of two, and the client sends a relation
          // header with it. Omitting the header is itself a way to get a 4xx
          // that says nothing about whether a failure was recorded.
          await rec.call(
            'results-executionlog-bogus-variant',
            'The EXECUTION log for this run, as src/runtime/atc/logs.ts getExecutionLog issues it — relation header included.',
            {
              method: 'GET',
              url: `${resultsHref}/log`,
              headers: {
                Accept: 'application/xml',
                'X-sap-adt-relation':
                  'http://www.sap.com/adt/atc/relations/results/log',
              },
            },
          );

          // The CHECK-FAILURE logs — a different resource entirely, filtered by
          // displayId. The spec claimed the probe read every place a result
          // could live while this one was never asked, so a failure recorded
          // here would have been missed and the 4xx from the other read as an
          // answer. Raised in review, 2026-08-17.
          const displayId =
            resultsHref.split('/').filter(Boolean).pop() ?? resultsHref;
          await rec.call(
            'checkfailures-logs-bogus-variant',
            'The CHECK-FAILURE logs for this run, as getCheckFailureLogs issues them: a separate resource under /atc/checkfailures/logs, filtered by displayId.',
            {
              method: 'GET',
              url: `${ATC}/checkfailures/logs?displayId=${encodeURIComponent(displayId)}`,
              headers: {
                Accept: 'application/xml',
                'X-sap-adt-relation':
                  'http://www.sap.com/adt/atc/relations/checkfailures/logs',
              },
            },
          );
        } else {
          logger.warn(
            'No /atc/results/ link in the run status, so the log could not be read.',
          );
        }

        // Which of two cases this run is in decides what the captures are worth,
        // and the sequence may contain no completion marker at all. `seen` holds
        // every status read including the last, so a `finished` that appears
        // only there counts — it used to be checked against the first eight
        // alone, which called a completed run unestablished.
        const sawFinished = seen.some(
          (v) => v.trim().toLowerCase() === 'finished',
        );
        if (sawFinished) {
          logger.warn(
            'The bogus-variant run reached `finished`. That is a COMPLETION marker, not a success: whether it ended in an error is not something the status says. The four captures are of a COMPLETED run — compare them against a healthy one.',
          );
        } else {
          logger.warn(
            `The bogus-variant run never reported \`finished\` within ${seen.length} samples (${seen.join(' → ')}). Completion is NOT established, and the four captures were taken while it may still have been running — they cannot be read as final.`,
          );
        }
      } else {
        logger.warn(
          'The bogus-variant run carried no Location, so its status could not be asked for.',
        );
      }
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
            // Durations, and no verdict from them. A ratio against one control
            // read is not a fact about the server: nothing here rules out the
            // two requests serialising over one connection, there is no absolute
            // threshold to compare against, and a single pair cannot separate
            // "held" from "slow". The numbers and both statuses are recorded;
            // deciding what they mean is a job for a session that repeats this
            // deliberately. Raised in review, 2026-08-16.
            const statusOf = (r: ICallResult) =>
              r.body.match(/runs:status="([^"]+)"/)?.[1] ?? 'unreadable';
            logger.info(
              `long polling: ${polled.durationMs}ms, status ${statusOf(polled)} | plain read started at the same moment: ${plain.durationMs}ms, status ${statusOf(plain)} — recorded as evidence, not read as a verdict`,
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
        ? `finished; per template: ${o.attempts.map((a) => `${a.template} → [${a.objectsListed.map((x) => `${x.type}:${x.name}`).join(', ') || 'nothing'}]`).join(' | ')}`
        : o.attempted
          ? 'run never reported finished'
          : 'never asked');

    /** A request with no status never reached a verdict — a fact about us. */
    const timedOut = (o: ICandidateOutcome) =>
      o.attempts.some((a) => a.status === null);

    // What this run is judged on, stated by the caller rather than inferred.
    const requiredCandidates = outcomes.filter((o) =>
      required.keys.includes(o.key),
    );
    const notCounted = outcomes.filter((o) => !required.keys.includes(o.key));
    const confirmed = requiredCandidates.filter((o) => o.confirmed);
    const unconfirmed = requiredCandidates.filter((o) => !o.confirmed);
    // The counted set is named in the verdict itself. A bare "COMPLETE" is what
    // made the previous version dangerous on an on-prem run: it was true about
    // the seven types it counted and silent about the two the run existed for.
    const verdict = verdictFor({
      requiredKeys: required.keys,
      source: required.source,
      confirmed: confirmed.length,
      unconfirmed: unconfirmed.map((o) => ({ key: o.key, why: why(o) })),
      refuse: required.refuse,
    });

    // A non-zero triple somewhere is what makes the positions readable at all.
    const nonZeroStats = rec.findingStats.filter(
      (f) => f.triple && !/^0\s*,\s*0\s*,\s*0$/.test(f.triple),
    );
    const findingStatsVerdict =
      rec.findingStats.length === 0
        ? "FINDING_STATS never appeared in any run response — the spec's premise for it is unconfirmed here"
        : nonZeroStats.length === 0
          ? 'FINDING_STATS seen but always zero — the positions remain undecoded; re-run with --known-bad=KEY:NAME'
          : `FINDING_STATS non-zero in ${nonZeroStats.length} run(s) — evidence collected, NOT decoded. Reading the positions needs the triples correlated with the findings' priorities, and a worklist carrying more than one priority; a single 0,0,1 beside one priority-3 finding is consistent with several orderings`;

    rec.flush({
      system: sapConfig.url,
      looksLikeCloud: isCloud,
      requiredKeys: required.keys,
      requiredFrom: required.source,
      checkVariant,
      checkVariantSource: args.variant ? '--variant' : 'systemCheckVariant',
      nominatedCheckVariant: nominatedVariant,
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
        const transport = timedOut(o)
          ? ' — the run request got NO ANSWER (timeout), so this says nothing about the type'
          : '';
        const weaker = o.seenCheckedInSomeWorklist
          ? ` — but ATC checked ${o.key} as ${o.seenCheckedInSomeWorklist.name} in the ${o.seenCheckedInSomeWorklist.worklistOf} worklist, so the TYPE is checkable and only the template is unproven`
          : '';
        logger.error(`  ${o.key}: ${why(o)}${transport}${weaker}`);
      }
    } else {
      logger.info(verdict);
    }

    // Probed but outside the required set. Said out loud with its status, so a
    // reader can see what this run touched without counting, rather than having
    // to infer the gap from the verdict's arithmetic.
    for (const o of notCounted) {
      logger.info(
        `not counted (${scopeOf(o.key)}-scope, not in --require) — ${o.key}: ${why(o)}`,
      );
    }

    // Last, and after the verdict, so it cannot be mistaken for one: a run that
    // did not say what it required does not get to exit 0, whatever it confirmed.
    if (required.refuse) {
      logger.error(
        'The verdict above counted the default cloud set on a system that is not cloud. Whatever it says, this run did not decide the on-prem-only types. Re-run with --require.',
      );
    }

    // One place decides, so the log and `$?` cannot disagree.
    process.exitCode = exitCodeFor({
      unconfirmed: unconfirmed.length,
      refuse: required.refuse,
    });
  } finally {
    // In `finally`, because it used to be on the success path only — so the run
    // that failed, the one worth repeating, was exactly the one that left a
    // session behind.
    //
    // `disconnect()` alone would not do: it leaves the ABAP security session
    // standing until `http/security_session_timeout`, and the pool is shared
    // with everyone on the system. Two runs of this probe on an on-prem system
    // were enough to make the next test run wait through
    // `globalSetup: no session available` four times over.
    await releaseTestConnection(connection);
  }

  logger.info(`Evidence written to ${outDir}`);
}

// Guarded so the pure parts of this file can be imported and tested. The
// verdict is the one thing here that must not lie, and an unimportable module
// is an untestable one.
if (require.main === module) {
  main().catch((error) => {
    // No logger here by design: this is the path where the probe itself broke,
    // and the process must exit non-zero with the reason visible.
    process.stderr.write(`probe-atc failed: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
