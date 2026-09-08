/**
 * What an ATC check variant is, over the wire, and whether a test may create one.
 *
 * The library can start an ATC run, but it takes the check variant the system
 * nominates. That variant decides whether anything is *found*, and a run that
 * finds nothing answers `FINDING_STATS "0,0,0"` — the same triple a run over
 * genuinely clean code answers. So a test that wants a known finding cannot
 * borrow the system's variant; it has to bring its own.
 *
 * `/sap/bc/adt/atc/checkvariants` is in this system's discovery document as a
 * workbench object type — `application/vnd.sap.adt.chkvv4+xml`, with the usual
 * `{?corrNr,lockHandle,version,accessMode,_action}` — but nothing in this
 * repository has ever sent it a byte. Everything below is therefore a question,
 * not a client:
 *
 *  1. **What does a variant document look like?** Read the one the system
 *     nominates, plus the form template and the check schema that ADT publishes
 *     beside it. Without a real document, a `create()` payload would be a guess.
 *
 *  2. **Which checks exist here, and are any of them aimed at what
 *     ZAC_SHR_ATC_DIRTY does wrong?** A variant naming checks this system does
 *     not have is a variant that finds nothing, which is the failure this whole
 *     exercise exists to avoid.
 *
 *  3. **May this user create and delete one?** CHKV maintenance is authorised
 *     separately from `S_DEVELOP`, and a BTP trial user is not a Q-system
 *     quality manager. If the answer is no, the plan changes rather than the
 *     test being written and left red.
 *
 *  4. **Does a run accept the variant we made?** The only end-to-end proof.
 *     Run the ATC client against the dirty class with `checkVariant` set, and
 *     record the triple. This step uses `AdtRuntimeClient`, not raw requests:
 *     the run path is already a client, and re-hand-rolling it here would test
 *     the probe rather than the library.
 *
 * **Nothing here concludes from silence.** Every step's raw body is written to
 * disk and the verdict names which of the four questions were answered. A step
 * that fails is evidence too — `403` to the POST settles question 3 as firmly
 * as `201` does.
 *
 * Usage:
 *   npx ts-node scripts/probe-atc-checkvariant.ts --out=atc-chkv-probe
 *
 *   --out=DIR        Where the evidence goes. Default `atc-chkv-probe`.
 *   --variant=NAME   Read this variant instead of the system's nominated one.
 *   --name=NAME      The variant to create. Default `ZAC_SHR_ATC_VAR`.
 *   --dirty=NAME     The class to run against. Default `ZAC_SHR_ATC_DIRTY`.
 *   --read-only      Ask questions 1 and 2 only: no POST, no lock, no DELETE.
 *
 * Writes `DIR/manifest.json` (every step, machine-readable) and one raw body
 * file per step. Read the raw files — the manifest is an index, not a summary.
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
import { AdtRuntimeClient } from '../src/clients/AdtRuntimeClient';
import { inStatefulSession } from '../src/core/shared/capabilities/statefulSession';
import { orThrow } from '../src/utils/adtResponse';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const ATC = '/sap/bc/adt/atc';
const CHKV = `${ATC}/checkvariants`;
const TIMEOUT = 60_000;

/** From the discovery document's own Accept list for each collection. */
const ACCEPT_CHKV = 'application/vnd.sap.adt.chkvv4+xml';
const ACCEPT_CHKO = 'application/vnd.sap.adt.chkov1+xml';
const ACCEPT_NAMED_ITEMS =
  'application/vnd.sap.adt.nameditems.v1+xml, application/xml';
const ACCEPT_CUSTOMIZING =
  'application/xml, application/vnd.sap.atc.customizing-v1+xml, application/vnd.sap.atc.customizing-v2+xml';
const ACCEPT_LOCK =
  'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result';

interface IStep {
  n: number;
  step: string;
  question: string;
  method: string;
  url: string;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  status: number | null;
  statusText?: string;
  responseHeaders?: Record<string, unknown>;
  error?: string;
  bodyFile?: string;
  bodyPreview?: string;
  durationMs: number;
}

interface ICallResult {
  status: number | null;
  body: string;
  headers: Record<string, unknown>;
}

/**
 * Every request, with its body on disk.
 *
 * A failed request is recorded exactly like a successful one. The status this
 * probe most needs to see — a refusal to create — arrives as a thrown error,
 * and a recorder that only kept successes would drop the answer.
 */
class Recorder {
  private readonly steps: IStep[] = [];
  private n = 0;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly outDir: string,
    private readonly logger: ILogger,
  ) {}

  async call(
    step: string,
    question: string,
    req: {
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      url: string;
      headers?: Record<string, string>;
      body?: unknown;
    },
  ): Promise<ICallResult> {
    const n = ++this.n;
    const record: IStep = {
      n,
      step,
      question,
      method: req.method,
      url: req.url,
      requestHeaders: req.headers,
      requestBody:
        typeof req.body === 'string' ? req.body.slice(0, 4000) : undefined,
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
        method: req.method,
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

    record.durationMs = Date.now() - startedAt;
    const file = `${String(n).padStart(2, '0')}-${step.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    fs.writeFileSync(path.join(this.outDir, file), body, 'utf8');
    record.bodyFile = file;
    record.bodyPreview = body.slice(0, 400);
    this.steps.push(record);
    this.logger.info(
      `[${n}] → ${record.status ?? 'no status'}, ${body.length} bytes, ${record.durationMs}ms → ${file}`,
    );
    return { status: record.status, body, headers };
  }

  note(step: string, question: string, text: string): void {
    const n = ++this.n;
    const file = `${String(n).padStart(2, '0')}-${step.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.txt`;
    fs.writeFileSync(path.join(this.outDir, file), text, 'utf8');
    this.steps.push({
      n,
      step,
      question,
      method: 'NOTE',
      url: '',
      status: null,
      bodyFile: file,
      bodyPreview: text.slice(0, 400),
      durationMs: 0,
    });
    this.logger.info(`[${n}] ${step} (note) → ${file}`);
  }

  flush(extra: Record<string, unknown>): void {
    fs.writeFileSync(
      path.join(this.outDir, 'manifest.json'),
      JSON.stringify({ ...extra, steps: this.steps }, null, 2),
      'utf8',
    );
  }
}

function parseSystemCheckVariant(body: string): string | null {
  const match = body.match(/name="systemCheckVariant"[^>]*value="([^"]+)"/);
  return match ? match[1] : null;
}

/** The lock handle, from the same envelope every other lock in this repo reads. */
function parseLockHandle(body: string): string | null {
  const match = body.match(/<LOCK_HANDLE>([^<]+)<\/LOCK_HANDLE>/);
  return match ? match[1] : null;
}

function parseArgs(argv: string[]) {
  const get = (name: string): string | undefined => {
    const hit = argv.find((a) => a.startsWith(`--${name}=`));
    return hit ? hit.slice(name.length + 3) : undefined;
  };
  return {
    outDir: get('out') ?? 'atc-chkv-probe',
    variant: get('variant'),
    newVariant: (get('name') ?? 'ZAC_SHR_ATC_VAR').toUpperCase(),
    dirtyClass: (get('dirty') ?? 'ZAC_SHR_ATC_DIRTY').toUpperCase(),
    readOnly: argv.includes('--read-only'),
  };
}

async function main(): Promise<void> {
  refuseWhileRunOwnsSession();

  const logger: ILogger = new DefaultLogger(LogLevel.INFO);
  const args = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(process.cwd(), args.outDir);
  fs.mkdirSync(outDir, { recursive: true });

  const sapConfig = getConfig();
  const connection = await createTestConnection(createConnectionLogger());
  const answered = {
    documentShape: false,
    checksListed: false,
    mayCreate: null as boolean | null,
    runAcceptedVariant: null as boolean | null,
  };
  let createdVariant: string | null = null;
  /** The document the creation payload is derived from, kept as it was read. */
  let systemVariantDocument = '';

  try {
    await connection.connect();
    logger.info(`Connected to ${sapConfig.url}`);
    const rec = new Recorder(connection, outDir, logger);

    // --- Q1. What does a variant document look like? -------------------------
    const customizing = await rec.call(
      'customizing',
      'Which variant does this system nominate?',
      {
        method: 'GET',
        url: `${ATC}/customizing`,
        headers: { Accept: ACCEPT_CUSTOMIZING },
      },
    );
    const systemVariant =
      args.variant ?? parseSystemCheckVariant(customizing.body);
    if (!systemVariant) {
      rec.note(
        'no-system-variant',
        'Which variant does this system nominate?',
        'No systemCheckVariant in the customizing response and no --variant given. ' +
          'A document to read has to come from somewhere; stopping the read questions here.',
      );
    } else {
      logger.info(`System check variant: ${systemVariant}`);
      const doc = await rec.call(
        'read-system-variant',
        'What does a chkvv4 document contain?',
        {
          method: 'GET',
          url: `${CHKV}/${encodeURIComponent(systemVariant.toLowerCase())}`,
          headers: { Accept: ACCEPT_CHKV },
        },
      );
      answered.documentShape = doc.status === 200 && doc.body.length > 0;
      systemVariantDocument = doc.body;

      await rec.call(
        'formtemplate',
        'Does ADT publish the variant document shape itself?',
        {
          method: 'GET',
          url: `${CHKV}/formtemplate?chkvName=${encodeURIComponent(systemVariant)}`,
          // Measured 2026-09-08: chkvv4 is refused here with 406 naming
          // `application/xml` as the only acceptable type.
          headers: { Accept: 'application/xml' },
        },
      );
    }

    // The collection listing, which is also the answer to "does a Z variant
    // already exist here from an earlier run".
    await rec.call('list-variants', 'What variants exist on this system?', {
      method: 'GET',
      url: CHKV,
      headers: { Accept: ACCEPT_NAMED_ITEMS },
    });

    // --- Q2. Which checks exist here? ----------------------------------------
    const checks = await rec.call(
      'list-checks',
      'Which checks can a variant name on this system?',
      {
        method: 'GET',
        url: `${ATC}/checks`,
        headers: { Accept: `${ACCEPT_CHKO}, ${ACCEPT_NAMED_ITEMS}` },
      },
    );

    // The other candidate, and the only one anyone has seen answer: PR #68's
    // `listAtcVariants` reads `/atc/variants`, not the `/atc/checkvariants`
    // discovery names. Two different URLs for the same subject, one of them
    // verified on an on-prem system in that PR and neither of them on cloud.
    const variants = await rec.call(
      'list-variants-pr68',
      'Does the URL PR #68 listed variants at answer on this system?',
      {
        method: 'GET',
        url: `${ATC}/variants?maxItemCount=500&name=*`,
        headers: { Accept: ACCEPT_NAMED_ITEMS },
      },
    );

    answered.checksListed =
      (checks.status === 200 && checks.body.length > 0) ||
      (variants.status === 200 && variants.body.length > 0);

    if (args.readOnly) {
      rec.note(
        'read-only',
        'May this user create a variant?',
        '--read-only was given: questions 3 and 4 were not asked.',
      );
    } else {
      // --- Q3. May this user create one? -------------------------------------
      //
      // The payload is the system variant's own document with the name swapped.
      // A hand-written body would test our XML rather than the server's rules,
      // and the point of this step is the server's answer, not ours.
      const source = systemVariantDocument;
      if (!source.trim()) {
        rec.note(
          'no-template-document',
          'May this user create a variant?',
          'The system variant could not be read, so there is no document to base a ' +
            'creation on. Asking the server to accept a body this probe invented ' +
            'would answer a different question than the one asked.',
        );
      } else {
        const payload = source
          .replace(/(adtcore:name=")[^"]+(")/, `$1${args.newVariant}$2`)
          .replace(/(chkv:name=")[^"]+(")/, `$1${args.newVariant}$2`);
        const created = await rec.call(
          'create-variant',
          'May this user create a check variant?',
          {
            method: 'POST',
            // Measured 2026-09-08: a bare POST here answers 400 "Parameter
            // corrNr could not be found" — the resource is mapped and the
            // parameter is what it wants. Empty is what a local object on ABAP
            // Cloud has to offer.
            url: `${CHKV}?corrNr=`,
            headers: {
              'Content-Type': ACCEPT_CHKV,
              Accept: ACCEPT_CHKV,
            },
            body: payload,
          },
        );
        answered.mayCreate = created.status !== null && created.status < 300;
        if (answered.mayCreate) {
          createdVariant = args.newVariant;
        }
      }

      // --- Q4. Does a run accept it? -----------------------------------------
      const variantForRun = createdVariant ?? systemVariant ?? undefined;
      if (!variantForRun) {
        rec.note(
          'no-variant-for-run',
          'Does a run accept a named variant?',
          'Neither a created variant nor a system variant to fall back on.',
        );
      } else {
        const atc = new AdtRuntimeClient(connection, logger).getAtc();
        try {
          const value = await orThrow(
            atc.run(
              {
                objects: [{ objectType: 'class', objectName: args.dirtyClass }],
              },
              { wait: true, checkVariant: variantForRun },
            ),
          );
          const triple = value.waited ? value.findingStats : '(not waited)';
          // The triple counts; the worklist says what was counted. Without it,
          // "0,1,0" names neither the check nor the priority, so the position
          // stays as undecoded as a row of zeroes would leave it.
          const findings = await orThrow(atc.getFindings(value.worklistId));
          fs.writeFileSync(
            path.join(outDir, 'findings.xml'),
            typeof findings === 'string' ? findings : String(findings),
            'utf8',
          );
          answered.runAcceptedVariant = true;
          rec.note(
            'run-with-variant',
            'Does a run accept a named variant, and what does it find?',
            `Variant: ${variantForRun}\nObject: class ${args.dirtyClass}\n` +
              `FINDING_STATS: ${triple}\n\n` +
              (triple === '0,0,0'
                ? 'Zero. Either the variant looks for none of what the dirty class does ' +
                  'wrong, or the class is not on this system. Both are answers; neither ' +
                  'is "the class is clean".'
                : 'Non-zero — the positions of FINDING_STATS can be read against what ' +
                  'the class actually contains.'),
          );
        } catch (error) {
          answered.runAcceptedVariant = false;
          rec.note(
            'run-with-variant-failed',
            'Does a run accept a named variant?',
            `Variant: ${variantForRun}\nRun rejected: ${String(error)}`,
          );
        }
      }
    }

    // --- Cleanup: whatever this probe created, it removes ---------------------
    if (createdVariant) {
      const uri = `${CHKV}/${encodeURIComponent(createdVariant.toLowerCase())}`;
      await inStatefulSession(connection, async () => {
        const lock = await rec.call(
          'lock-created-variant',
          'Is a variant locked like every other workbench object?',
          {
            method: 'POST',
            url: `${uri}?_action=LOCK&accessMode=MODIFY`,
            headers: { Accept: ACCEPT_LOCK },
            body: null,
          },
        );
        const handle = parseLockHandle(lock.body);
        await rec.call(
          'delete-created-variant',
          'May this user delete a check variant?',
          {
            method: 'DELETE',
            url: handle
              ? `${uri}?lockHandle=${encodeURIComponent(handle)}`
              : uri,
          },
        );
      });
    }

    rec.flush({
      probe: 'atc-checkvariant',
      system: sapConfig.url,
      startedAt: new Date().toISOString(),
      args,
      answered,
    });

    const unanswered = Object.entries(answered)
      .filter(([, v]) => v === false || v === null)
      .map(([k]) => k);
    if (unanswered.length > 0) {
      logger.warn(
        `Unanswered: ${unanswered.join(', ')} — read the raw bodies before designing anything on top of this.`,
      );
      process.exitCode = 1;
    } else {
      logger.info('All four questions answered.');
    }
  } finally {
    // In `finally`: the run worth repeating is the one that failed, and it is
    // the one that would otherwise leave a session standing on a system whose
    // pool this probe shares with every test run.
    await releaseTestConnection(connection);
  }

  logger.info(`Evidence written to ${outDir}`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`probe-atc-checkvariant failed: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
