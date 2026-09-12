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
 * **Nothing here concludes from silence — or from a status alone.** Every
 * step's raw body is written to disk and the verdict names which of the four
 * questions were answered. A failure is evidence too, but only of what it
 * actually shows: a `201` settles question 3, while a `403` does not. The one
 * measured here named `S_ABPLNGVS`, which is the ABAP language version rather
 * than a role — an unresolvable version surfaces AS an authorization refusal —
 * so it may be about the payload this probe sent. Read the body; the verdict
 * leaves that question open rather than answering it from a number.
 *
 * Usage:
 *   npx ts-node scripts/probe-atc-checkvariant.ts --out=atc-chkv-probe
 *
 *   --out=DIR        Where the evidence goes. Default `atc-chkv-probe`.
 *   --variant=NAME   Read this variant instead of the system's nominated one.
 *   --name=NAME      The variant to create. Default `ZAC_SHR_ATC_VAR`.
 *   --dirty=NAME     The class to run against. Default `ZAC_SHR_ATC_DIRTY`.
 *   --read-only      Ask questions 1 and 2 only: no POST, no lock, no DELETE.
 *                    The verdict then judges those two alone, so the mode can
 *                    succeed; a full run still needs all four.
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
import { classifyCreateOutcome, classifyRunOutcome } from './lib/atcOutcomes';

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

/**
 * The checks a form template names.
 *
 * This is what answers "which checks exist here": `/atc/checks` does not list
 * on the measured system, and a list of *variants* answers a different
 * question entirely — a variant is a selection of checks, not a check.
 * Measured 2026-09-08: the trial's form template carries 172 of these across
 * 36 categories, e.g. `SLIN_VERS`, `SYCM_CHECK_ABAP_LANGU_VERSION`.
 */
function parseCheckNames(body: string): string[] {
  return [
    ...new Set(
      [...body.matchAll(/<chko:checkObject[^>]*adtcore:name="([^"]+)"/g)].map(
        (m) => m[1],
      ),
    ),
  ];
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
  /**
   * Whether each question got an answer, kept apart from what the answer was.
   *
   * A booleans-only version conflated the two and then judged the run by it:
   * `mayCreate: false` meant "the system refused", which this probe's whole
   * contract calls a settled answer — a 403 closes question 3 as firmly as a
   * 201 — yet it counted as unanswered and exited non-zero. `no` is a result;
   * only `unknown` is a gap.
   */
  const answered: Record<
    'documentShape' | 'checksListed' | 'mayCreate' | 'runAcceptedVariant',
    'yes' | 'no' | 'unknown'
  > = {
    documentShape: 'unknown',
    checksListed: 'unknown',
    mayCreate: 'unknown',
    runAcceptedVariant: 'unknown',
  };
  /** The run made against a variant this probe did NOT create, if any. */
  let fallbackRun: { variant: string; findingStats: string } | null = null;
  /** What the creation attempt answered, so the classification is checkable. */
  let createStatus: number | null = null;
  let createdVariant: string | null = null;
  /**
   * What this probe made and could not unmake.
   *
   * An array rather than a nullable string so a write inside a callback is
   * still visible to the reader below — and because "nothing left behind" is
   * the only acceptable ending, whatever else the probe did or did not learn.
   */
  const leftBehind: string[] = [];

  // Declared beside the connection rather than inside the try below: the
  // `finally` has to reach both to undo what was done and to write the
  // evidence, and it cannot see anything the try scoped.
  const rec = new Recorder(connection, outDir, logger);

  /**
   * Is there a variant by this name — yes, no, or the system did not say?
   *
   * Three values and not a boolean, because the third one decides whether this
   * probe is allowed to write at all. `absent` covers both spellings of it:
   * measured 2026-09-08, this resource answers a missing name with **404**
   * (`GET /atc/checkvariants/zac_shr_atc_var` → 404, 551 bytes), unlike the
   * source endpoints elsewhere in ADT that answer absence with an empty 200 —
   * so both are accepted here rather than one of them guessed.
   * Anything else — a dropped socket, a 403, a 500 — is `unknown`, and a probe
   * that cannot see whether a name is taken cannot promise to clean up after
   * itself.
   */
  const variantPresence = async (
    name: string,
    step: string,
    question: string,
  ): Promise<'present' | 'absent' | 'unknown'> => {
    const read = await rec.call(step, question, {
      method: 'GET',
      url: `${CHKV}/${encodeURIComponent(name.toLowerCase())}`,
      headers: { Accept: ACCEPT_CHKV },
    });
    if (read.status === 200) {
      return read.body.trim().length > 0 ? 'present' : 'absent';
    }
    return read.status === 404 ? 'absent' : 'unknown';
  };

  /**
   * Remove what the probe made, and notice when it could not.
   *
   * `rec.call` swallows HTTP failures on purpose — a 403 to the POST is the
   * answer this probe exists to record, not a crash — which means a failed
   * DELETE is just as quiet. So the status is read here: a variant this run
   * created and did not remove is residue in someone's system and the next
   * run's name collision, and it must not end in a process that exits 0
   * announcing that every question was answered.
   */
  const removeCreatedVariant = async (name: string): Promise<void> => {
    const uri = `${CHKV}/${encodeURIComponent(name.toLowerCase())}`;
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
      const deleted = await rec.call(
        'delete-created-variant',
        'May this user delete a check variant?',
        {
          method: 'DELETE',
          url: handle ? `${uri}?lockHandle=${encodeURIComponent(handle)}` : uri,
        },
      );
      // 404 counts as gone: something removed it, and the probe's job was
      // that it not be there.
      const gone =
        deleted.status !== null &&
        (deleted.status < 300 || deleted.status === 404);
      if (!gone) {
        leftBehind.push(name);
      }
    });
  };

  /** The document the creation payload is derived from, kept as it was read. */
  let systemVariantDocument = '';
  /** Counts, so the manifest carries evidence rather than a boolean. */
  let checkNames: string[] = [];
  let variantCount = 0;

  try {
    await connection.connect();
    logger.info(`Connected to ${sapConfig.url}`);

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
      answered.documentShape =
        doc.status === 200 && doc.body.length > 0 ? 'yes' : 'unknown';
      systemVariantDocument = doc.body;

      const formTemplate = await rec.call(
        'formtemplate',
        'Does ADT publish the variant document shape, and the checks it offers?',
        {
          method: 'GET',
          url: `${CHKV}/formtemplate?chkvName=${encodeURIComponent(systemVariant)}`,
          // Measured 2026-09-08: chkvv4 is refused here with 406 naming
          // `application/xml` as the only acceptable type.
          headers: { Accept: 'application/xml' },
        },
      );
      checkNames = parseCheckNames(formTemplate.body);
      if (checkNames.length > 0) {
        logger.info(
          `Form template names ${checkNames.length} checks, e.g. ${checkNames
            .slice(0, 3)
            .join(', ')}`,
        );
      }
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

    // The listing, which is a different resource from the object type rather
    // than a different spelling of it. Discovery carries both: "ATC Check
    // Variant" is `/atc/checkvariants` (the CHKV workbench object, addressed by
    // name, chkvv4+xml), while "List of Variants" is `/atc/variants`
    // {?maxItemCount,data} — and only the second one lists. PR #68 read this
    // one; the collection GET above is the other, and answers uriMappingError.
    const variants = await rec.call(
      'list-variants-pr68',
      'Does the URL PR #68 listed variants at answer on this system?',
      {
        method: 'GET',
        url: `${ATC}/variants?maxItemCount=500&name=*`,
        headers: { Accept: ACCEPT_NAMED_ITEMS },
      },
    );

    variantCount = (variants.body.match(/<nameditem:name>/g) ?? []).length;

    // Checks, and only checks — the variants listing answers "which selections
    // of checks exist", a different question.
    //
    // And one set of names behind both the count and the boolean. Reading
    // `/atc/checks` as "answered" on a non-empty body while counting only the
    // form template's names allowed `checksListed: true` beside
    // `checksSeen: 0` — a claim with nothing under it, which is what the count
    // was added to prevent.
    checkNames = [...new Set([...checkNames, ...parseCheckNames(checks.body)])];
    answered.checksListed = checkNames.length > 0 ? 'yes' : 'unknown';

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
        // Ask whether the name is free BEFORE writing. Not politeness: the
        // check after the POST is what makes an ambiguous write safe, and it
        // can only mean "this run made it" if the name was demonstrably absent
        // beforehand. Without that, a variant someone else owns would be read
        // as ours and deleted.
        const before = await variantPresence(
          args.newVariant,
          'name-free-before-create',
          'Is this name free to create, and free to delete afterwards?',
        );

        if (before !== 'absent') {
          rec.note(
            'create-not-attempted',
            'May this user create a check variant?',
            before === 'present'
              ? `${args.newVariant} already exists on this system, so nothing was ` +
                  'created. This probe removes what it made, never what it found — ' +
                  'delete it by hand if it is a leftover, or pass --name=OTHER.'
              : 'The system did not say whether this name is taken. Creating now ' +
                  "would risk either writing over someone else's object or leaving " +
                  'one behind unrecognised, so nothing was written.',
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
              // parameter is what it wants. Empty is what a local object on
              // ABAP Cloud has to offer.
              url: `${CHKV}?corrNr=`,
              headers: {
                'Content-Type': ACCEPT_CHKV,
                Accept: ACCEPT_CHKV,
              },
              body: payload,
            },
          );

          // Recorded for every attempt, not just the failed ones: the field is
          // the evidence the verdict is judged against, and a `mayCreate: yes`
          // beside a null status is a claim with its receipt missing.
          createStatus = created.status;

          if (created.status !== null && created.status < 300) {
            // The system said it wrote. Nothing read afterwards can take that
            // back — a 404 a moment later is eventual consistency, not an
            // undo, and a read that fails is the network's problem, not the
            // object's. Either would have this run walk away from something it
            // had just created, so a 2xx hands ownership to the cleanup
            // outright and no read is consulted.
            createdVariant = args.newVariant;
            answered.mayCreate = 'yes';
          } else {
            // Only a write that did NOT plainly succeed needs the system asked.
            // `status: null` is the dangerous one — a dropped socket after SAP
            // committed — and a 5xx can mean the same. A 403 will simply say
            // absent, which costs one request and settles it.
            const after = await variantPresence(
              args.newVariant,
              'name-taken-after-create',
              'Did the POST leave a variant behind, whatever it answered?',
            );
            answered.mayCreate = classifyCreateOutcome(created.status, after);
            if (answered.mayCreate === 'yes') {
              createdVariant = args.newVariant;
            } else {
              if (answered.mayCreate === 'unknown' && after === 'absent') {
                rec.note(
                  'create-inconclusive',
                  'May this user create a check variant?',
                  `The POST answered ${created.status ?? 'nothing'} and no ` +
                    'variant appeared. That says this request did not create ' +
                    'one — not that creation is refused. Read ' +
                    "`create-variant`'s body: a 400 here has already been a " +
                    'complaint about the URL rather than about authorisation.',
                );
              }
              if (after === 'unknown') {
                rec.note(
                  'create-outcome-unknown',
                  'Did the POST leave a variant behind?',
                  `Neither the POST nor the read after it said whether ` +
                    `${args.newVariant} now exists. If it does, this run created ` +
                    'it and did not remove it — check the system before running ' +
                    'again.',
                );
                leftBehind.push(`${args.newVariant} (unconfirmed)`);
              }
            }
          }
        }
      }

      // --- Q4. Does a run accept it? -----------------------------------------
      // Question 4 is "does a run accept the variant WE made". A run against
      // the variant the system nominates cannot answer it: it proves the run
      // path works, which was never in doubt, and says nothing about whether a
      // document this probe wrote is usable. So the fallback still runs — it is
      // where the FINDING_STATS evidence comes from — but it is recorded as
      // itself, and question 4 stays open until there is a created variant to
      // ask it about.
      const ourVariant = createdVariant;
      const variantForRun = ourVariant ?? systemVariant ?? undefined;
      if (!variantForRun) {
        rec.note(
          'no-variant-for-run',
          'Does a run accept a named variant?',
          'Neither a created variant nor a system variant to fall back on.',
        );
      } else {
        const atc = new AdtRuntimeClient(connection, logger).getAtc();

        // Only the run itself answers question 4, so only the run is inside
        // this try. It used to wrap the worklist read and a local file write
        // as well, which meant a failed `getFindings` — or a full disk —
        // reported the variant as REJECTED by a run that had in fact accepted
        // it. What comes after is evidence about the findings, not about
        // whether the variant was usable.
        let accepted: { triple: string; worklistId: string } | null = null;
        // The answer is read rather than thrown, because `orThrow` keeps the
        // message and drops the one field that says whether this was a verdict:
        // `origin`. A refusal is SAP looking at the request and saying no; a
        // `connection` failure is a timeout, a dropped socket or an expired
        // session, none of which is a statement about the variant.
        let failure: {
          origin: string;
          status?: number;
          message: string;
        } | null = null;
        try {
          // The variant is named, so no customizing read; the worklist is its
          // own call since 19.0.0.
          const worklistId = await atc.createWorklist(variantForRun);
          const answer = await atc.startRun(
            worklistId,
            {
              objects: [{ objectType: 'class', objectName: args.dirtyClass }],
            },
            { wait: true, checkVariant: variantForRun },
          );
          if (answer.ok) {
            const value = answer.getResult().value;
            accepted = {
              triple: value.waited ? value.findingStats : '(not waited)',
              worklistId: value.worklistId,
            };
            if (ourVariant) {
              answered.runAcceptedVariant = 'yes';
            } else {
              fallbackRun = {
                variant: variantForRun,
                findingStats: accepted.triple,
              };
            }
          } else {
            const error = answer.getError();
            failure = {
              origin: error.origin,
              status: error.response?.status,
              message: error.message,
            };
          }
        } catch (error) {
          // The implementation threw rather than answering — its own reading
          // failed, which says nothing about the variant.
          failure = { origin: 'thrown', message: String(error) };
        }

        if (failure) {
          const verdict = classifyRunOutcome(
            failure.origin as 'connection' | 'refusal' | 'thrown',
            failure.status,
            failure.message,
            variantForRun,
          );
          // Only about the variant the question is about, and only when the
          // failure was a verdict rather than a silence.
          if (ourVariant) {
            answered.runAcceptedVariant = verdict;
          }
          rec.note(
            'run-with-variant-failed',
            'Does a run accept a named variant?',
            `Variant: ${variantForRun}\n` +
              `origin=${failure.origin} status=${failure.status ?? 'none'}\n` +
              `${failure.message}\n\n` +
              (verdict === 'no'
                ? 'SAP refused, naming the variant — that is an answer about it.'
                : 'Not an answer about the variant. One run() resolves a variant, ' +
                  'creates a worklist and submits the run, so a refusal may be ' +
                  'about the target or authorization; and a transport failure is ' +
                  'not a refusal at all. Question 4 stays open.'),
          );
        }

        if (accepted) {
          const { triple, worklistId } = accepted;
          rec.note(
            ourVariant ? 'run-with-our-variant' : 'run-with-system-variant',
            ourVariant
              ? 'Does a run accept the variant this probe created?'
              : 'No variant of ours to ask about — what does the system variant find?',
            `Variant: ${variantForRun}${ourVariant ? ' (created by this run)' : ' (the system nominates it; NOT ours)'}\n` +
              `Object: class ${args.dirtyClass}\n` +
              `FINDING_STATS: ${triple}\n\n` +
              (triple === '0,0,0'
                ? 'Zero. Either the variant looks for none of what the dirty class does ' +
                  'wrong, or the class is not on this system. Both are answers; neither ' +
                  'is "the class is clean".'
                : 'Non-zero — the positions of FINDING_STATS can be read against what ' +
                  'the class actually contains.'),
          );

          // The triple counts; the worklist says what was counted. A failure
          // here costs the findings file and nothing else — the run's verdict
          // above is already settled.
          try {
            const findings = await orThrow(atc.getFindings(worklistId));
            fs.writeFileSync(
              path.join(outDir, 'findings.xml'),
              typeof findings === 'string' ? findings : String(findings),
              'utf8',
            );
          } catch (error) {
            rec.note(
              'findings-unread',
              'What did the run find?',
              `The run was accepted and reported ${triple}, but reading its ` +
                `worklist ${worklistId} failed: ${String(error)}. That is a ` +
                'missing detail, not a rejected variant.',
            );
          }
        }
      }
    }
  } finally {
    // Undo, record, judge — then hang up, whatever any of that did.
    //
    // The logout used to be the last statement of this block rather than its
    // `finally`, so a failure while writing the evidence — a full disk, an
    // output directory pulled out from under the run — skipped it and left an
    // ABAP session standing. Recording what happened must not cost the session
    // it happened in.
    try {
      // Everything below runs whatever happened above, in this order: undo,
      // record, judge, hang up.
      //
      // The cleanup used to sit on the success path, so an error anywhere
      // between the POST that created a variant and this point skipped it — the
      // run that failed, the one worth repeating, was exactly the one that left
      // something behind.
      if (createdVariant) {
        try {
          await removeCreatedVariant(createdVariant);
        } catch (error) {
          leftBehind.push(createdVariant);
          rec.note(
            'cleanup-failed',
            'Was everything this probe created removed?',
            `Removing ${createdVariant} threw: ${String(error)}`,
          );
        }
      }

      rec.flush({
        probe: 'atc-checkvariant',
        system: sapConfig.url,
        startedAt: new Date().toISOString(),
        args,
        answered,
        createStatus,
        checksSeen: checkNames.length,
        variantsSeen: variantCount,
        fallbackRun,
        leftBehind,
      });

      // What this run was asked to settle. `--read-only` does not ask questions 3
      // and 4, so counting their `null` against it made the documented mode
      // impossible to pass: it exited 1 having answered everything it was for.
      const required: Array<keyof typeof answered> = args.readOnly
        ? ['documentShape', 'checksListed']
        : ['documentShape', 'checksListed', 'mayCreate', 'runAcceptedVariant'];
      const unanswered = required.filter((key) => answered[key] === 'unknown');
      logger.info(
        required.map((key) => `${key}: ${answered[key]}`).join(', ') +
          ` (checks seen ${checkNames.length}, variants seen ${variantCount})`,
      );
      if (leftBehind.length > 0) {
        logger.error(
          `LEFT BEHIND in ${sapConfig.url}: ${leftBehind.join(', ')} — this probe created ` +
            'them and could not remove them. Delete them before the next run, which ' +
            'would otherwise collide with the same name.',
        );
        process.exitCode = 1;
      }
      if (unanswered.length > 0) {
        logger.warn(
          `Unanswered: ${unanswered.join(', ')} — read the raw bodies before designing anything on top of this.`,
        );
        process.exitCode = 1;
      } else if (leftBehind.length === 0) {
        logger.info(
          args.readOnly
            ? 'Both read-only questions answered, nothing left behind.'
            : 'All four questions answered, nothing left behind.',
        );
      }
    } finally {
      // The pool is shared with every test run, and a session left standing is
      // felt by whoever runs next.
      await releaseTestConnection(connection);
    }
  }

  logger.info(`Evidence written to ${outDir}`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`probe-atc-checkvariant failed: ${String(error)}\n`);
    process.exitCode = 1;
  });
}
