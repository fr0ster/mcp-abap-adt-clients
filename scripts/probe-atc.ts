/**
 * ATC probe — captures the traffic the ATC spec is blocked on.
 *
 * The spec (`docs/superpowers/specs/2026-08-15-atc-run-and-findings.md`) is
 * complete except for facts nobody has captured. This script captures them and
 * writes every request and response to disk verbatim, so the spec can quote a
 * response rather than an expectation.
 *
 * It answers, on whichever system `.env` points at:
 *
 *  1. **`AtcObjectType`** — the blocker. Runs a check against one object of
 *     every type found in a real package, using **the URI ADT itself returned**
 *     for that object rather than a hand-written mapping. PR #68 maps six types
 *     from memory; this measures the set instead.
 *  2. **`GET` or `POST /atc/customizing`** — #68 sends GET, the spec's traffic
 *     table records POST. One of them is wrong. Both are sent here.
 *  3. **Plural object references** — one run over every picked object at once,
 *     which is the shape `IAtcRunTarget` promises.
 *  4. **A bogus URI, as a control.** Without it, "the run was accepted" proves
 *     nothing: if ADT accepts a URI that cannot exist, acceptance is not
 *     evidence that a type is checkable.
 *  5. The loose ends: `includeExemptedFindings=true`, `checkstyle`,
 *     `maximumVerdicts` at its edges, `clientWait=true`, `GET /atc/runs/{id}`.
 *
 * Nothing is interpreted here. Every step is recorded with its status and body
 * whether it succeeds or fails, because a 406 and a 404 are results too — three
 * of the spec's established facts are error responses.
 *
 * Usage:
 *   npx ts-node scripts/probe-atc.ts
 *   npx ts-node scripts/probe-atc.ts --package=ZADT_BLD_PKG03 --out=atc-probe
 *   MCP_ENV_PATH=./trial.env npx ts-node scripts/probe-atc.ts
 *
 * Flags:
 *   --package=NAME   package to take probe objects from
 *                    (default: `environment.default_package` from test-config.yaml)
 *   --out=DIR        where to write the evidence (default: atc-probe/)
 *   --max-types=N    probe at most N distinct object types (default: all found)
 *
 * Writes `DIR/manifest.json` (every step, machine-readable) plus one raw body
 * file per step. Read the raw files — the manifest is an index, not a summary.
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
  ): Promise<{ status: number | null; body: string }> {
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
      record.responseHeaders = response.headers as Record<string, unknown>;
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
      record.responseHeaders = e.response?.headers;
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
    return { status: record.status, body };
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

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  return {
    packageName: get('package'),
    outDir: get('out') ?? 'atc-probe',
    maxTypes: get('max-types') ? Number(get('max-types')) : undefined,
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

async function main(): Promise<void> {
  // A probe that says nothing while it works is unusable; INFO regardless of DEBUG_* flags.
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
    'PR #68 sends GET here; the spec records POST. Which one answers?',
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

  const checkVariant =
    parseSystemCheckVariant(customizingGet.body) ??
    parseSystemCheckVariant(customizingPost.body);
  if (!checkVariant) {
    logger.error(
      'No systemCheckVariant in either customizing response. Everything below needs one; stopping here with the evidence written.',
    );
    rec.flush({ system: sapConfig.url, checkVariant: null });
    return;
  }
  logger.info(`Check variant: ${checkVariant}`);

  // --- 2. Real objects, with the URIs ADT gave for them ---------------------
  const packageName = args.packageName ?? defaultPackageFromTestConfig(logger);
  if (!packageName) {
    logger.error(
      'No package to probe. Pass --package=NAME or set environment.default_package in test-config.yaml.',
    );
    rec.flush({ system: sapConfig.url, checkVariant });
    return;
  }

  logger.info(`Reading contents of ${packageName}`);
  const contents = await utils.getPackageContentsList(packageName, {
    includeSubpackages: true,
  });

  // One object per ADT type code. `uri` is what ADT returned for that object —
  // the point of picking this way is that no mapping is being guessed.
  const byType = new Map<string, { name: string; type: string; uri: string }>();
  for (const item of contents) {
    if (!item.uri || item.isPackage) continue;
    if (!byType.has(item.type)) {
      byType.set(item.type, {
        name: item.name,
        type: item.type,
        uri: item.uri,
      });
    }
  }
  let picked = [...byType.values()];
  if (args.maxTypes && picked.length > args.maxTypes) {
    picked = picked.slice(0, args.maxTypes);
  }
  logger.info(
    `Probing ${picked.length} object types: ${picked.map((p) => `${p.type}:${p.name}`).join(', ')}`,
  );
  if (picked.length === 0) {
    logger.error(
      `${packageName} contains no objects with URIs. Nothing to check — pass a package that has some.`,
    );
    rec.flush({ system: sapConfig.url, checkVariant, packageName });
    return;
  }

  /** One worklist per run: a worklist is per-run state, and reusing one would blur whose findings are whose. */
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
    if (!id)
      logger.warn(
        `No worklist id parsed from ${label}: ${res.body.slice(0, 120)}`,
      );
    return id;
  };

  // --- 3. The blocker: one run per object type -----------------------------
  for (const obj of picked) {
    const label = obj.type.replace(/[^a-z0-9]+/gi, '-');
    const worklistId = await newWorklist(label);
    if (!worklistId) continue;

    await rec.call(
      `run-${label}`,
      `Is ${obj.type} checkable? This is the AtcObjectType blocker — ${obj.name}, at the URI ADT returned.`,
      {
        method: 'POST',
        url: `${ATC}/runs?worklistId=${encodeURIComponent(worklistId)}&clientWait=false`,
        headers: {
          'Content-Type': CT_ATC_RUN,
          Accept: ACCEPT_ATC_RUN_RESPONSE,
        },
        body: runBody([obj.uri], 100),
      },
    );

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

  // --- 4. The control: a URI that cannot exist ------------------------------
  const controlWorklist = await newWorklist('control');
  if (controlWorklist) {
    await rec.call(
      'run-control-bogus-uri',
      'Does ATC reject a URI that cannot exist? If not, "accepted" above is not evidence of anything.',
      {
        method: 'POST',
        url: `${ATC}/runs?worklistId=${encodeURIComponent(controlWorklist)}&clientWait=false`,
        headers: {
          'Content-Type': CT_ATC_RUN,
          Accept: ACCEPT_ATC_RUN_RESPONSE,
        },
        body: runBody(['/sap/bc/adt/oo/classes/ZZ_NO_SUCH_CLASS_PROBE'], 100),
      },
    );
  }

  // --- 5. Plural references, which is the shape the contract promises ------
  if (picked.length > 1) {
    const multiWorklist = await newWorklist('multi');
    if (multiWorklist) {
      await rec.call(
        'run-multiple-objects',
        'IAtcRunTarget takes a set. Does one run accept several object references?',
        {
          method: 'POST',
          url: `${ATC}/runs?worklistId=${encodeURIComponent(multiWorklist)}&clientWait=false`,
          headers: {
            'Content-Type': CT_ATC_RUN,
            Accept: ACCEPT_ATC_RUN_RESPONSE,
          },
          body: runBody(
            picked.map((p) => p.uri),
            100,
          ),
        },
      );
      await rec.call(
        'findings-multi-exempted-true',
        'Does includeExemptedFindings=true exist at all? It stays out of the contract until this answers.',
        {
          method: 'GET',
          url: `${ATC}/worklists/${encodeURIComponent(multiWorklist)}?includeExemptedFindings=true`,
          headers: { Accept: ACCEPT_ATC_WORKLIST_XML },
        },
      );
      await rec.call(
        'findings-checkstyle',
        'The spec says checkstyle is answered with 406 and one accepted type. Confirm or refute.',
        {
          method: 'GET',
          url: `${ATC}/worklists/${encodeURIComponent(multiWorklist)}`,
          headers: { Accept: ACCEPT_ATC_WORKLIST_CHECKSTYLE },
        },
      );
      await rec.call(
        'run-status-by-worklist-id',
        'The spec says there is no run resource: GET /atc/runs/{id} → 404. Confirm against the worklist id the run echoed.',
        {
          method: 'GET',
          url: `${ATC}/runs/${encodeURIComponent(multiWorklist)}`,
          headers: { Accept: ACCEPT_ATC_RUN_STATUS },
        },
      );
    }
  }

  // --- 6. maximumVerdicts at its edges, and clientWait ----------------------
  const first = picked[0];
  for (const verdicts of [0, 1, 100000]) {
    const w = await newWorklist(`verdicts-${verdicts}`);
    if (!w) continue;
    await rec.call(
      `run-maximumVerdicts-${verdicts}`,
      'The server bounds on maximumVerdicts, which nothing states. Decides whether run() should validate a range.',
      {
        method: 'POST',
        url: `${ATC}/runs?worklistId=${encodeURIComponent(w)}&clientWait=false`,
        headers: {
          'Content-Type': CT_ATC_RUN,
          Accept: ACCEPT_ATC_RUN_RESPONSE,
        },
        body: runBody([first.uri], verdicts),
      },
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
        body: runBody([first.uri], 100),
      },
    );
  }

  rec.flush({
    system: sapConfig.url,
    checkVariant,
    packageName,
    probedTypes: picked.map((p) => ({
      type: p.type,
      name: p.name,
      uri: p.uri,
    })),
  });
  logger.info(`Evidence written to ${outDir}`);
}

main().catch((error) => {
  // No logger here by design: this is the path where the probe itself broke,
  // and the process must exit non-zero with the reason visible.
  process.stderr.write(`probe-atc failed: ${String(error)}\n`);
  process.exitCode = 1;
});
