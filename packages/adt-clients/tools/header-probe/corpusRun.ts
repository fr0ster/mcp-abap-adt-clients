/**
 * One run of the error corpus on a connection it is given: the authorization
 * check, the probes of one source in one headers mode, the cleanup, the two
 * files. The command line, the session and Ctrl-C are errorCorpus.ts's.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { IAdtHeaders, IAnalyse } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtClient } from '../../src/clients/AdtClient';
import { ACCEPT_DISCOVERY } from '../../src/constants/contentTypes';
import {
  cleanupOf,
  gate,
  gateConnect,
  type ICallOn,
  type ICapture,
  type IEnvelopeTiming,
  type IMeter,
  LogonRefused,
  message,
  runCalls,
  send,
  statusOfError,
  traced,
  watchAnswers,
} from './capture';
import {
  askedFor,
  authorizationProblem,
  authorizationVerdict,
  type BogusHeader,
  bogusHeaders,
  buildHeaderCorpus,
  classifyNeeds,
  contentTypeNotSent,
  discoveryProbes,
  dumpText,
  emptyNamed,
  evidenceOf,
  existencePerEndpoint,
  FIXED_TEXT,
  fakeBody,
  type HeadersMode,
  headerShape,
  type ICorpus,
  type ICorpusRow,
  type IDiscoveryProbe,
  type IEvidence,
  type IHeaderCorpusFile,
  type ISplit,
  isIsolated,
  isLongPoll,
  type IEndpointFilter,
  isWrite,
  judge,
  LONG_POLL_SKIP,
  markUnauthorized,
  needsCounts,
  PROBE_NAME,
  PROBE_PACKAGE,
  parseDiscovery,
  passesFilter,
  readCorpusAnswer,
  renderCorpusMarkdown,
  renderHeaderCorpus,
  rowKey,
  type Source,
  selfCheck,
  wireNote,
  withContrast,
  workingContentTypes,
  writeCheck,
} from './corpus';
import {
  type ILedgerEntry,
  type Interrupt,
  Interrupted,
  Ledger,
  withCleanup,
} from './ledger';
import {
  baseHandler,
  clientsOn,
  handlerSpecs,
  type IClients,
  type IMemberEndpoint,
  deletesUnderLock,
  pairOf,
  recordMembers,
  temporaryObjectsSet,
  UNIVERSAL,
} from './members';
import { coverageOf, runOnTemporaryObjects } from './objectRun';
import type { ITemporaryContext } from './objects';
import { lockHandle } from './probe';
import {
  endpointKey,
  endpointOf,
  type IRemoval,
  isEmptyAnswer,
  removalWord,
  unproven,
} from './record';

/** How many probes go in one envelope (each write probe brings its read). */
export const ENVELOPE_PROBES = 25;

type ClientOptions = ConstructorParameters<typeof AdtClient>[2];

/** A raw request's answer, handed to `analyse` as a member's would be. */
function answered(
  request: Promise<IAdtWireResponse>,
  analyse: IAnalyse,
): Promise<unknown> {
  return request.then(
    (wire) => analyse(undefined as never, wire),
    (error: unknown) => {
      const wire = (error as { response?: IAdtWireResponse })?.response;
      if (wire && typeof wire.status === 'number')
        return analyse(undefined as never, wire);
      throw error;
    },
  );
}

const headersOf = (asked: {
  accept?: string;
  contentType?: string;
}): Record<string, string> => {
  const headers: Record<string, string> = {};
  if (asked.accept !== undefined) headers.Accept = asked.accept;
  if (asked.contentType !== undefined)
    headers['Content-Type'] = asked.contentType;
  return headers;
};

/** The Content-Type a member put on its request, if any. */
const contentTypeOf = (
  headers: IAbapRequestOptions['headers'],
): string | undefined => {
  for (const [key, value] of Object.entries(headers ?? {}))
    if (key.toLowerCase() === 'content-type' && value) return String(value);
  return undefined;
};

/** Whether a read after a write shows the probe object: a 2xx naming it. */
export function existsAfter(
  capture: ICapture | undefined,
): NonNullable<ICorpusRow['afterWrite']> {
  const check = writeCheck(capture?.wire);
  if (check.exists !== true) {
    if (!capture?.wire && capture?.failure) check.note = capture.failure;
    return check;
  }
  const body = String(capture?.wire?.data ?? '').toLowerCase();
  if (!body.includes(PROBE_NAME.toLowerCase()))
    return {
      exists: 'unknown',
      status: check.status,
      note: 'the read answered 2xx without naming the probe object',
    };
  return check;
}

/** One probe as it runs: the call, the read after a write, and the row both fill. */
interface IPlanned<T> {
  row: ICorpusRow;
  call: ICallOn<T>;
  read?: ICallOn<T>;
  /** Runs on its own, not in an envelope: why. */
  sequential?: string;
  /** What to do once the answers are in (a lock to release, an object to remove). */
  after?: (probe: ICapture, read?: ICapture) => void;
  /** The probe writes (POST, PUT, DELETE): never resent by a split. */
  write?: boolean;
  /** The last answer to its read, for the poisoning test. */
  readAnswer?: { status?: number; body: string };
}

interface IOutput {
  progress: (line: string) => void;
  loud: (line: string) => void;
}

class Run<T> {
  constructor(
    private readonly connection: IAbapConnection,
    private readonly mode: HeadersMode,
    private readonly direct: T,
    private readonly onBatch: (batch: IAbapConnection) => T,
    private readonly interrupt: Interrupt,
    private readonly out: IOutput,
    private readonly meter: IMeter,
    /** `--sequential`: nothing in an envelope. */
    private readonly sequential = false,
    /** Probes per envelope. */
    private readonly envelopeProbes = ENVELOPE_PROBES,
  ) {}

  private fill(planned: IPlanned<T>, probe: ICapture, read?: ICapture): void {
    const row = readCorpusAnswer(planned.row, {
      wire: probe.wire,
      failure: probe.failure,
    });
    row.onWire = probe.onWire ?? [];
    const note = wireNote(this.mode, row.onWire);
    if (note) row.wireNote = note;
    if (planned.read) row.afterWrite = existsAfter(read);
    planned.after?.(probe, read);
  }

  private async send(
    planned: readonly IPlanned<T>[],
    batched: boolean,
    ran: (planned: IPlanned<T>) => string,
  ): Promise<void> {
    const calls: ICallOn<T>[] = [];
    for (const entry of planned) {
      calls.push(entry.call);
      if (entry.read) calls.push(entry.read);
    }
    const captures: ICapture[] = [];
    let stopped: unknown;
    try {
      await runCalls({
        calls,
        batched,
        connection: this.connection,
        direct: this.direct,
        onBatch: this.onBatch,
        interrupt: this.interrupt,
        meter: this.meter,
        captures,
      });
    } catch (error) {
      // Ctrl-C between two requests: what did answer is still recorded.
      stopped = error;
    }
    let at = 0;
    for (const entry of planned) {
      const probe = captures[at++];
      const read = entry.read ? captures[at++] : undefined;
      // A call the interrupt kept from running has nothing to record.
      if (!probe || (!probe.requests.length && !probe.wire && !probe.failure))
        break;
      entry.readAnswer = read
        ? {
            status: read.wire?.status,
            body: String(read.wire?.data ?? ''),
          }
        : undefined;
      entry.row.ran = ran(entry);
      const envelope = probe.envelopes?.[0];
      if (envelope !== undefined) {
        entry.row.envelope = envelope;
        entry.row.ms = this.meter.envelopes.find(
          (e) => e.id === envelope,
        )?.msPerPart;
      } else if (probe.ms !== undefined) entry.row.ms = probe.ms;
      this.fill(entry, probe, read);
    }
    if (stopped) throw stopped;
  }

  /** Every poisoned envelope and how it was split. */
  readonly splits: ISplit[] = [];

  /**
   * Splits a poisoned envelope's probes into ten groups, in order, and sends
   * each as an envelope of its own. A group that comes back clean is
   * settled; one poisoned again is split the same way; a poisoned single
   * call is sent alone, and its answer — the dump — is its own.
   */
  private async settle(
    entries: readonly IPlanned<T>[],
    path: readonly string[],
    depth: number,
    split: ISplit,
  ): Promise<void> {
    const reads: IPlanned<T>[] = [];
    const writes: IPlanned<T>[] = [];
    for (const entry of entries)
      if (entry.write) {
        resetAnswer(entry.row);
        entry.row.settled = { depth, path: path.join(' → ') };
        writes.push(entry);
      } else reads.push(entry);
    // A write is not resent; whether it took effect is read, on its own.
    for (const entry of writes) {
      this.interrupt.check();
      let after = 'unreadable (no read of the object)';
      if (entry.read) {
        const [read] = await runCalls({
          calls: [entry.read],
          batched: false,
          connection: this.connection,
          direct: this.direct,
          onBatch: this.onBatch,
          interrupt: this.interrupt,
        });
        entry.row.afterWrite = existsAfter(read);
        after =
          entry.row.afterWrite.exists === true
            ? 'exists'
            : entry.row.afterWrite.exists === false
              ? 'absent'
              : `unreadable ${entry.row.afterWrite.status ?? entry.row.afterWrite.note ?? ''}`.trim();
        if (entry.row.afterWrite.exists === true)
          split.writesThatExist.push(rowKey(entry.row));
      }
      entry.row.failure = `poisoned, not resent: write; after: ${after}`;
    }
    for (const [index, group] of splitInTen(reads).entries()) {
      this.interrupt.check();
      const where = [...path, `group ${index + 1}`];
      for (const entry of group) resetAnswer(entry.row);
      await this.send(group, true, () => `batched: ${where.join(' → ')}`);
      if (group.length > 1 && isPoisoned(group)) {
        await this.settle(group, where, depth + 1, split);
        continue;
      }
      const [only] = group;
      if (group.length === 1 && only.row.status === 500) {
        resetAnswer(only.row);
        split.requestsAlone++;
        await this.send(
          group,
          false,
          () => `sequential: alone, ${where.join(' → ')}`,
        );
        only.row.settled = {
          depth: depth + 1,
          path: [...where, 'alone'].join(' → '),
        };
        if (only.row.status === 500) {
          only.row.poisonCause = true;
          split.causes.push(rowKey(only.row));
        }
        continue;
      }
      for (const entry of group)
        entry.row.settled = { depth, path: where.join(' → ') };
    }
  }

  /** Sends everything: in envelopes, and what cannot go in one on its own. */
  async all(planned: readonly IPlanned<T>[]): Promise<void> {
    if (this.sequential) {
      this.out.progress(`  ${planned.length} probes one by one (--sequential)`);
      for (const entry of planned) {
        this.interrupt.check();
        await this.send([entry], false, (e) =>
          e.sequential
            ? `sequential: ${e.sequential}`
            : 'sequential: --sequential',
        );
      }
      return;
    }
    const batchable = planned.filter((entry) => !entry.sequential);
    const chunks = Math.ceil(batchable.length / this.envelopeProbes);
    for (let chunk = 0; chunk < chunks; chunk++) {
      this.interrupt.check();
      const part = batchable.slice(
        chunk * this.envelopeProbes,
        (chunk + 1) * this.envelopeProbes,
      );
      this.out.progress(
        `  envelope ${chunk + 1}/${chunks}: ${part.length} probes`,
      );
      await this.send(part, true, () => 'batched');
      const first = part[0].row;
      const envelopeId = first.envelope ?? '?';
      if (isPoisoned(part)) {
        // One part's dump answered for every part (measured: all parts of an
        // envelope got the same 500 page, while each sent alone got its own
        // answer): split until the call that dumps is found.
        const said = first.sapMessage ?? dumpText(first.body);
        this.out.progress(
          `  every part of envelope ${envelopeId} answered the same 500${said ? ` (${said})` : ''}; splitting it`,
        );
        const before = this.meter.envelopes.length;
        const started = performance.now();
        const split: ISplit = {
          envelope: envelopeId,
          parts: part.length,
          causes: [],
          writesThatExist: [],
          envelopes: 0,
          requestsAlone: 0,
          ms: 0,
        };
        for (const entry of part)
          entry.row.inEnvelope = `500 in envelope ${envelopeId}`;
        await this.settle(part, [`env ${envelopeId}`], 1, split);
        split.envelopes = this.meter.envelopes.length - before;
        split.ms = performance.now() - started;
        this.splits.push(split);
      }
      // An envelope with no answer is not resent: whether the server ran
      // any of it is unknown. Its parts keep `envelope failed: <reason>`.
    }
    const alone = planned.filter((entry) => entry.sequential);
    if (alone.length) {
      this.interrupt.check();
      this.out.progress(`  ${alone.length} probes one by one`);
    }
    for (const entry of alone) {
      this.interrupt.check();
      await this.send([entry], false, (e) => `sequential: ${e.sequential}`);
    }
  }
}

/** Sends alone, from the start, each call an earlier run found poisoning envelopes. */
function isolateKnown(
  planned: readonly { row: ICorpusRow; sequential?: string }[],
  keys: ReadonlySet<string> | undefined,
): void {
  if (!keys?.size) return;
  for (const entry of planned)
    if (!entry.sequential && isIsolated(entry.row, keys))
      entry.sequential =
        'isolated: an earlier run found it poisoning its envelope (--isolate)';
}

/**
 * A poisoned envelope: more than one part, and every part — the reads after
 * the writes included — answered 500 with the same text.
 */
export function isPoisoned(
  entries: readonly {
    row: ICorpusRow;
    readAnswer?: { status?: number; body: string };
  }[],
): boolean {
  const answers: { status?: number; body: string }[] = [];
  for (const entry of entries) {
    answers.push({ status: entry.row.status, body: entry.row.body ?? '' });
    if (entry.readAnswer) answers.push(entry.readAnswer);
  }
  if (answers.length < 2) return false;
  const text = (body: string) => dumpText(body) ?? body;
  const first = text(answers[0].body);
  return answers.every(
    (answer) => answer.status === 500 && text(answer.body) === first,
  );
}

/**
 * Ten groups of about a tenth each, in order; never an empty group, so
 * fewer than ten entries make one group each.
 */
export function splitInTen<E>(entries: readonly E[]): E[][] {
  const groups: E[][] = [];
  const count = Math.min(10, entries.length);
  let at = 0;
  for (let index = 0; index < count; index++) {
    const size = Math.floor((entries.length - at) / (count - index));
    groups.push(entries.slice(at, at + size));
    at += size;
  }
  return groups;
}

/** Clears what a row's first answer filled in, before it is sent again. */
function resetAnswer(row: ICorpusRow): void {
  for (const key of [
    'status',
    'sapType',
    'sapMessage',
    'responseContentType',
    'body',
    'failure',
    'afterWrite',
    'envelope',
    'ms',
    'wireNote',
  ] as const)
    delete row[key];
  row.named = emptyNamed();
  row.onWire = [];
}

/**
 * What a removal proves: removed only on positive evidence — the read after
 * the delete answered absent, or a 2xx delete and a read that does not find
 * the object; not removed when the read still finds it; anything else
 * (unreadable reads, a failed delete) may remain.
 */
export function removalOutcome(
  after: 'absent' | 'exists' | 'not found' | 'unreadable',
  deleted: number | undefined,
  afterStatus: number | undefined,
  what: string,
): { removed: boolean | 'unknown'; detail: string } {
  const deleteOk = deleted !== undefined && deleted >= 200 && deleted < 300;
  if (after === 'absent')
    return { removed: true, detail: `deleted (${deleted ?? 'no status'})` };
  if (after === 'not found' && deleteOk)
    return {
      removed: true,
      detail: `deleted (${deleted}); the read (${afterStatus}) does not find it`,
    };
  if (after === 'exists')
    return {
      removed: false,
      detail: `the delete answered ${deleted ?? 'nothing'}; ${what} still reads ${afterStatus ?? 'unknown'}`,
    };
  return {
    removed: 'unknown',
    detail: `unknown ${afterStatus ?? 'no answer'}: the delete answered ${deleted ?? 'nothing'} and ${what} cannot be read; it may remain`,
  };
}

/** Where an authorization problem stopped a run. */
export interface IAuthStop {
  status: number;
  /** The SAP exception type, or `CSRF`. */
  kind: string;
  endpoint: string;
}

/** Watches every answer for an authorization problem; the first stops the run. */
export function guardAuthorization(
  interrupt: Interrupt,
  onStop?: (stop: IAuthStop) => void,
  recordUnauthorized = false,
): {
  stop: () => IAuthStop | undefined;
  release: () => void;
} {
  let stopped: IAuthStop | undefined;
  const release = watchAnswers((wire, request) => {
    if (stopped) return;
    const problem = authorizationProblem(wire);
    if (!problem) return;
    // Recorded, not a stop: this user's authorization 403 after the first
    // read. A 401, a CSRF 403 and the discovery read itself still stop.
    if (
      recordUnauthorized &&
      problem.status === 403 &&
      problem.kind !== 'CSRF' &&
      String(request.url ?? '').split('?')[0] !== '/sap/bc/adt/discovery'
    )
      return;
    stopped = {
      ...problem,
      endpoint: endpointKey(
        endpointOf(
          String(request.method ?? ''),
          String(request.url ?? ''),
          request.params,
          [PROBE_NAME, PROBE_PACKAGE],
        ),
      ),
    };
    onStop?.(stopped);
    // Nothing new goes out; what is in flight finishes, the cleanup runs.
    interrupt.stop('authorization');
  });
  return { stop: () => stopped, release };
}

/** The line an authorization stop ends with. */
export const authorizationLine = (stop: IAuthStop): string =>
  `Oops: authorization problem (${stop.status}, ${stop.kind}) at ${stop.endpoint} — fix it and run again`;

/** A raw request's status, an error's included. */
const statusOf = (request: Promise<IAdtWireResponse>) =>
  request.then(
    (wire) => wire.status,
    (error: unknown) => statusOfError(error),
  );

/** Removes an object a discovery write created, through the deletion endpoint, by its URI. */
export function discoveryRemoval(
  connection: IAbapConnection,
  uri: string,
): () => Promise<{ removed: boolean | 'unknown'; detail: string }> {
  // Cleanup: through the gate's cleanup sibling, past a stop.
  const cleanup = cleanupOf(connection);
  const request = () =>
    send(cleanup, {
      url: uri,
      method: 'GET',
      timeout: 0,
      headers: { Accept: '*/*' },
    });
  // Exists only as a 2xx naming the probe, as after a write.
  const readState = () =>
    request().then(
      (wire) => existsAfter({ requests: [], wire }),
      (error: unknown) =>
        existsAfter({
          requests: [],
          wire: (error as { response?: IAdtWireResponse })?.response,
        }),
    );
  return async () => {
    const before = await readState();
    if (before.exists === false) return { removed: true, detail: 'not there' };
    // Readable or not, the deletion is sent: a read that says nothing proves
    // nothing about the object.
    const headers = pairOf('getUtils()', 'deleteObjectsGroup') as IAdtHeaders;
    const body = `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">\n  <del:object adtcore:uri="${uri}">\n    <del:transportNumber/>\n  </del:object>\n</del:deletionRequest>`;
    const deleted = await statusOf(
      send(cleanup, {
        url: '/sap/bc/adt/deletion/delete',
        method: 'POST',
        timeout: 0,
        data: body,
        headers: {
          Accept: headers.accept,
          'Content-Type': headers.contentType,
        },
      }),
    );
    const after = await readState();
    return removalOutcome(
      after.exists === false
        ? 'absent'
        : after.exists === true
          ? 'exists'
          : after.status !== undefined &&
              after.status >= 200 &&
              after.status < 300
            ? 'not found'
            : 'unreadable',
      deleted,
      after.status,
      uri,
    );
  };
}

interface IContext {
  connection: IAbapConnection;
  mode: HeadersMode;
  interrupt: Interrupt;
  ledger: Ledger;
  corpus: ICorpus;
  clientOptions: ClientOptions;
  out: IOutput;
  meter: IMeter;
  sequential: boolean;
  only?: string[];
  except?: string[];
  envelopeProbes: number;
  /** The calls an earlier run found poisoning envelopes: each is sent alone. */
  isolate?: ReadonlySet<string>;
  /** Adds a ledger entry once per key, before the write it covers is sent. */
  register: (key: string, entry: () => ILedgerEntry) => void;
  /** Where the temporary objects are made; absent: the probe name for every member. */
  temporary?: ITemporaryContext;
  /** What failed on the temporary objects (an unlock): the run ends failed. */
  failures: string[];
  /** A session of its own, ended after: frees a lock no handle came back for. */
  ownSession?: OwnSession;
}

/** Where the calls go: the connection (or the envelope), and whether it is an envelope. */
interface ITarget {
  base: IAbapConnection;
  parts: boolean;
}

async function runDiscovery(ctx: IContext, document: string): Promise<void> {
  const collections = parseDiscovery(document);
  ctx.corpus.collections = collections;
  const probes = discoveryProbes(collections, ctx.mode).filter((probe) =>
    passesFilter(ctx, probe.collection.href),
  );
  ctx.out.progress(
    `discovery: ${collections.length} collections, ${probes.length} probes`,
  );
  const planned = probes.map((probe: IDiscoveryProbe): IPlanned<ITarget> => {
    const { collection } = probe;
    const first = probe.corpusType ?? collection.accept[0];
    const row: ICorpusRow = {
      source: 'discovery',
      group: collection.workspace,
      label: collection.title ?? collection.href,
      endpoint: { method: probe.method, path: collection.href },
      requests: [{ method: probe.method, path: collection.href }],
      collection,
      asked: probe.asked,
      onWire: [],
      named: emptyNamed(),
      ...(first ? { pair: { contentType: first } } : {}),
      ...(probe.bogus ? { bogus: probe.bogus } : {}),
      ...(probe.corpusType ? { corpusType: probe.corpusType } : {}),
      ...(probe.noCorpusPair ? { noCorpusPair: probe.noCorpusPair } : {}),
      ...(probe.contentTypeNotSent
        ? { contentTypeNotSent: probe.contentTypeNotSent }
        : {}),
      ...(ctx.mode !== 'none' && probe.bogus !== 'accept'
        ? { acceptNote: 'accept: not in discovery' }
        : {}),
    };
    const uri = `${collection.href.replace(/\/$/, '')}/${encodeURIComponent(PROBE_NAME.toLowerCase())}`;
    const write = isWrite(probe.method);
    const entry: IPlanned<ITarget> = {
      row,
      call: (on, analyse) => {
        // Into the ledger before the write is sent, whatever follows: an
        // interrupt before the read, a read that fails or says nothing.
        if (write)
          ctx.register(`discovery ${uri}`, () => ({
            label: `discovery: ${uri} (written by ${probe.method} ${collection.href})`,
            remove: discoveryRemoval(ctx.connection, uri),
          }));
        return answered(
          send(
            traced(on.base, {
              shape: headerShape(ctx.mode, on.parts, probe.bogus),
              parts: on.parts,
            }),
            {
              url: collection.href,
              method: probe.method,
              timeout: 0,
              ...(probe.body !== undefined ? { data: probe.body } : {}),
              headers: headersOf(probe.asked),
            },
          ),
          analyse,
        );
      },
      write,
    };
    if (write) {
      entry.read = (on, analyse) =>
        answered(
          send(traced(on.base, { parts: on.parts }), {
            url: uri,
            method: 'GET',
            timeout: 0,
            headers: { Accept: '*/*' },
          }),
          analyse,
        );
      entry.after = () => {
        if (row.afterWrite?.exists === true)
          ctx.out.loud(`!!! ${probe.method} ${collection.href} created ${uri}`);
      };
    }
    return entry;
  });
  ctx.corpus.rows.push(...planned.map((entry) => entry.row));
  isolateKnown(planned, ctx.isolate);
  for (const [index, probe] of probes.entries())
    if (probe.skipped) planned[index].row.skipped = probe.skipped;
  const sent = planned.filter((_entry, index) => !probes[index].skipped);
  const run = new Run<ITarget>(
    ctx.connection,
    ctx.mode,
    { base: ctx.connection, parts: false },
    (batch) => ({ base: batch, parts: true }),
    ctx.interrupt,
    ctx.out,
    ctx.meter,
    ctx.sequential,
    ctx.envelopeProbes,
  );
  try {
    await run.all(sent);
  } finally {
    ctx.corpus.splits = [...(ctx.corpus.splits ?? []), ...run.splits];
  }
}

type IHandler = Record<string, (...args: unknown[]) => unknown>;

/**
 * The headers a member is given in a mode: its pair (a header the table
 * names none for is empty, so no header goes), or empty ones in `none`. The
 * shape then puts the probe type in, or takes a header away.
 */
export function headersFor(
  mode: HeadersMode,
  member: Pick<IMemberEndpoint, 'pair'>,
): IAdtHeaders {
  if (mode === 'none') return { accept: '', contentType: '' };
  return {
    accept: member.pair?.accept ?? '',
    contentType: member.pair?.contentType ?? '',
  };
}

async function runClients(ctx: IContext): Promise<void> {
  const recorded = await recordMembers();
  const members = recorded.members.filter((member) =>
    passesFilter(ctx, `${member.handler}.${member.member}`),
  );
  const helpers = recorded.helpers;
  ctx.corpus.notMembers = helpers;
  const clientsAt = (
    on: ITarget,
    bogus?: BogusHeader,
    plain = false,
  ): IClients =>
    clientsOn(
      traced(on.base, {
        ...(plain
          ? {}
          : {
              shape: headerShape(ctx.mode, on.parts, bogus),
              // Writes never create on purpose: the member's endpoint and
              // headers, a fake body.
              body: (request: IAbapRequestOptions) =>
                ctx.mode === 'none'
                  ? FIXED_TEXT
                  : fakeBody(contentTypeOf(request.headers)),
            }),
        parts: on.parts,
      }),
      ctx.clientOptions,
    );
  const direct: ITarget = { base: ctx.connection, parts: false };
  const onBatch = (batch: IAbapConnection): ITarget => ({
    base: batch,
    parts: true,
  });
  // Cleanup and unlocks: through the gate's cleanup sibling, past a stop.
  const once = (call: ICallOn<ITarget>) =>
    runCalls({
      calls: [call],
      batched: false,
      connection: ctx.connection,
      direct: { base: cleanupOf(ctx.connection), parts: false },
      onBatch,
    }).then(([capture]) => capture);
  const reference = clientsAt(direct, undefined, true);
  const specs = new Map(
    handlerSpecs(reference).map((spec) => [spec.label, spec]),
  );
  ctx.out.progress(
    `clients: ${members.length} members, ${members.filter((member) => !member.skipped).length} to send`,
  );
  const planned: IPlanned<ITarget>[] = [];
  // The members that work on an object run on a temporary object, after the
  // probe name's; the rest — and every member without a package to make one
  // in — on the probe name, as before.
  const onObjects: IMemberEndpoint[] = [];
  ctx.corpus.coverage = [];
  for (const member of members) {
    const coverage = coverageOf(member);
    ctx.corpus.coverage.push({
      member: `${member.handler}.${member.member}`,
      coverage:
        coverage.kind === 'object'
          ? `temporary ${coverage.type}`
          : coverage.kind === 'not coverable'
            ? `not coverable: ${coverage.reason}`
            : 'no object: the probe name',
    });
    if (coverage.kind === 'object' && ctx.temporary) {
      const last = member.requests[member.requests.length - 1];
      if (
        ctx.mode === 'corpus' &&
        !member.skipped &&
        last &&
        isLongPoll(last.method, last.path)
      )
        member.skipped = LONG_POLL_SKIP;
      onObjects.push(member);
    }
  }
  for (const member of members) {
    if (onObjects.includes(member)) continue;
    const spec = specs.get(member.handler);
    const call = member.call;
    const coverage = coverageOf(member);
    // A long-poll endpoint holds the request when it accepts the headers:
    // not sent with them (LONG_POLL_ENDPOINTS); none and bogus go out.
    const last = member.requests[member.requests.length - 1];
    if (
      ctx.mode === 'corpus' &&
      !member.skipped &&
      last &&
      isLongPoll(last.method, last.path)
    )
      member.skipped = LONG_POLL_SKIP;
    const hasBody = member.hasBody === true;
    const kinds: (BogusHeader | undefined)[] =
      ctx.mode === 'bogus' && call && spec && !member.skipped
        ? bogusHeaders(hasBody)
        : [undefined];
    for (const bogus of kinds) {
      const row: ICorpusRow = {
        source: 'clients',
        group: member.handler,
        label: member.member,
        requests: member.requests,
        onWire: [],
        named: emptyNamed(),
        ...(member.requests.length
          ? { endpoint: member.requests[member.requests.length - 1] }
          : {}),
        ...(member.pair ? { pair: { ...member.pair } } : {}),
        ...(bogus ? { bogus } : {}),
        ...(member.standIn ? { standIn: member.standIn } : {}),
        ...(coverage.kind === 'not coverable'
          ? { coverage: `not coverable: ${coverage.reason}` }
          : {}),
      };
      ctx.corpus.rows.push(row);
      if (member.skipped || !call || !spec) {
        row.skipped = member.skipped ?? 'skipped: the handler is not reachable';
        continue;
      }
      const headers = headersFor(ctx.mode, member);
      row.asked = askedFor(ctx.mode, member.pair, hasBody, bogus);
      const notSentNote =
        ctx.mode === 'none'
          ? undefined
          : contentTypeNotSent(member.pair, hasBody);
      if (notSentNote) row.contentTypeNotSent = notSentNote;
      if (ctx.mode === 'corpus' && !member.pair)
        row.noCorpusPair =
          "no pair in pairs.ts: the member's own headers, none where it takes them from the caller";
      const handlerOf = (clients: IClients) => spec.of(clients) as IHandler;
      const write = member.requests.some((request) => isWrite(request.method));
      const readable = typeof handlerOf(reference).readMetadata === 'function';
      const locks = member.requests.some(
        (request) => request.action === 'LOCK',
      );
      const label = `${member.handler}.${member.member}`;
      const entry: IPlanned<ITarget> = {
        row,
        call: (on, analyse) => {
          // Into the ledger before the write is sent, whatever follows.
          // A client set's object is the base client's: one entry, read and
          // deleted through the base handler (measured on 7.40: the other
          // package's read answered nothing, so its entry could not be
          // checked).
          if (write && readable) {
            const base = specs.get(baseHandler(member.handler)) ?? spec;
            // Where a registered set takes over the temporary objects (the
            // base client cannot remove them on that system), through its
            // handler of the same name.
            const takeover = temporaryObjectsSet();
            const takenOver = takeover
              ? specs.get(`${takeover.prefix}${base.label}`)
              : undefined;
            // The set's handler first; the base handler when the set's sends
            // no read (a type it refuses outright).
            const handlers = [takenOver, base]
              .filter((owner) => owner !== undefined)
              .map((owner) => ({
                label: owner.label,
                at: (target: ITarget) =>
                  owner.of(clientsAt(target, undefined, true)) as IHandler,
                reference: owner.of(reference) as IHandler,
              }));
            ctx.register(`clients ${base.label}`, () => ({
              label: `clients: ${base.label} ${PROBE_NAME} (written by ${member.handler}.${member.member})`,
              remove: clientsRemoval(once, handlers),
            }));
          }
          return call(handlerOf(clientsAt(on, bogus)) as never, {
            headers,
            analyse,
          });
        },
        write,
      };
      if (member.requests.length > 1)
        entry.sequential = `a chain of ${member.requests.length} requests, each sent after the answer before`;
      if (write && readable)
        entry.read = (on, analyse) =>
          Promise.resolve(
            handlerOf(clientsAt(on, undefined, true)).readMetadata(UNIVERSAL, {
              analyse,
            }),
          );
      entry.after = (probe) => {
        if (write && !readable)
          row.afterWrite = {
            exists: 'unknown',
            note: 'the handler reads no object to check',
          };
        if (row.afterWrite?.exists === true)
          ctx.out.loud(`!!! ${label} created ${PROBE_NAME}`);
        if (locks && row.status !== undefined && row.status < 300) {
          const result = probe.result as
            | { ok?: boolean; getResult?: () => { value: unknown } }
            | undefined;
          const handle =
            result?.ok && result.getResult
              ? result.getResult().value
              : undefined;
          ctx.out.loud(
            `!!! ${label} answered ${row.status}: a lock was granted`,
          );
          ctx.ledger.add({
            label: `clients: the lock ${label} took on ${PROBE_NAME}`,
            remove: async () => {
              if (typeof handle !== 'string' || !handle)
                return {
                  removed: false,
                  detail: 'no lock handle came back to release',
                };
              const unlocked = await once((on, analyse) =>
                Promise.resolve(
                  handlerOf(clientsAt(on, undefined, true)).unlock(
                    UNIVERSAL,
                    handle,
                    {
                      analyse,
                    },
                  ),
                ),
              );
              const status = unlocked.wire?.status;
              return status !== undefined && status < 300
                ? { removed: true, detail: `unlocked (${status})` }
                : {
                    removed: false,
                    detail: `the unlock answered ${status ?? unlocked.failure}`,
                  };
            },
          });
        }
      };
      isolateKnown([entry], ctx.isolate);
      planned.push(entry);
    }
  }
  const run = new Run<ITarget>(
    ctx.connection,
    ctx.mode,
    direct,
    onBatch,
    ctx.interrupt,
    ctx.out,
    ctx.meter,
    ctx.sequential,
    ctx.envelopeProbes,
  );
  try {
    await run.all(planned);
  } finally {
    ctx.corpus.splits = [...(ctx.corpus.splits ?? []), ...run.splits];
  }
  const temporary = ctx.temporary;
  if (!temporary || !onObjects.length) return;
  ctx.out.progress(`clients: ${onObjects.length} members on temporary objects`);
  const runner = (batched: boolean, connection = ctx.connection) =>
    new Run<ITarget>(
      connection,
      ctx.mode,
      connection === ctx.connection
        ? direct
        : { base: connection, parts: false },
      onBatch,
      ctx.interrupt,
      ctx.out,
      ctx.meter,
      batched ? ctx.sequential : true,
      ctx.envelopeProbes,
    );
  const made = await runOnTemporaryObjects<ITarget>({
    connection: ctx.connection,
    mode: ctx.mode,
    members: onObjects,
    specs,
    clientOptions: ctx.clientOptions,
    interrupt: ctx.interrupt,
    ledger: ctx.ledger,
    context: temporary,
    progress: ctx.out.progress,
    rows: ctx.corpus.rows,
    target: (on) => on,
    headersFor: (member) => headersFor(ctx.mode, member),
    ...(ctx.ownSession ? { ownSession: ctx.ownSession } : {}),
    send: async (plans, batched, connection) => {
      const run = runner(batched, connection);
      try {
        await run.all(
          plans.map((plan) => ({
            row: plan.row,
            call: plan.call,
            write: plan.write,
            ...(plan.after
              ? { after: (probe: ICapture) => plan.after?.(probe) }
              : {}),
          })),
        );
      } finally {
        ctx.corpus.splits = [...(ctx.corpus.splits ?? []), ...run.splits];
      }
    },
  });
  ctx.corpus.temporaryObjects = made.objects;
  ctx.failures.push(...made.failures);
}

/** Removes the probe object a member's write created: the handler's delete, then a read. */
function clientsRemoval(
  once: (call: ICallOn<ITarget>) => Promise<ICapture>,
  handlers: readonly {
    label: string;
    at: (on: ITarget) => IHandler;
    reference: IHandler;
  }[],
): () => Promise<{ removed: boolean | 'unknown'; detail: string }> {
  // The first handler whose read sends a request does the removal.
  let chosen = handlers[0];
  const read = () =>
    once((on, analyse) =>
      Promise.resolve(chosen.at(on).readMetadata(UNIVERSAL, { analyse })),
    );
  // Absent: a 404, or (where an unknown path answers 2xx) an empty 2xx.
  const absent = (wire: IAdtWireResponse | undefined) =>
    wire?.status === 404 || (wire !== undefined && isEmptyAnswer(wire));
  return async () => {
    let first: ICapture | undefined;
    for (const candidate of handlers) {
      chosen = candidate;
      first = await read();
      if (first.wire) break;
    }
    const { at: handlerAt, reference, label: handler } = chosen;
    const beforeCapture = first?.wire;
    const before = beforeCapture?.status;
    if (absent(beforeCapture))
      return { removed: true, detail: 'not there any more' };
    const pair = pairOf(handler, 'delete');
    if (
      !pair?.accept ||
      !pair.contentType ||
      typeof reference.delete !== 'function'
    )
      return before !== undefined && before >= 200 && before < 300
        ? {
            removed: false,
            detail: `${handler} has no delete with a pair; the object reads ${before}`,
          }
        : {
            removed: 'unknown' as const,
            detail: `unknown ${before ?? 'no answer'}: ${handler} has no delete with a pair and the read cannot rule the object out`,
          };
    const headers = { accept: pair.accept, contentType: pair.contentType };
    // Where the delete is made under the caller's lock: lock, delete with the
    // handle, unlock.
    const held = deletesUnderLock()
      ? lockHandle(
          await once((on, analyse) =>
            Promise.resolve(handlerAt(on).lock(UNIVERSAL, { analyse })),
          ),
        )
      : undefined;
    let deleted: ICapture;
    try {
      deleted = await once((on, analyse) =>
        Promise.resolve(
          handlerAt(on).delete(UNIVERSAL, {
            headers,
            analyse,
            ...(held ? { lockHandle: held } : {}),
          }),
        ),
      );
    } finally {
      if (held)
        await once((on, analyse) =>
          Promise.resolve(handlerAt(on).unlock(UNIVERSAL, held, { analyse })),
        );
    }
    const afterCapture = (await read()).wire;
    const after = afterCapture?.status;
    // A metadata read that answers 2xx with a document finds the object.
    return removalOutcome(
      absent(afterCapture)
        ? 'absent'
        : after !== undefined && after >= 200 && after < 300
          ? 'exists'
          : 'unreadable',
      deleted.wire?.status,
      after,
      handler,
    );
  };
}

/** The authorization check: the discovery document, or the reason to stop. */
export async function readDiscovery(
  connection: IAbapConnection,
): Promise<
  { ok: true; document: string } | { ok: false; exitCode: number; line: string }
> {
  let status: number | undefined;
  let document = '';
  try {
    // Traced: the authorization watcher sees this read too.
    const wire = await send(connection, {
      url: '/sap/bc/adt/discovery',
      method: 'GET',
      timeout: 0,
      headers: { Accept: ACCEPT_DISCOVERY },
    });
    status = wire.status;
    document = typeof wire.data === 'string' ? wire.data : '';
  } catch (error) {
    status = statusOfError(error);
  }
  const verdict = authorizationVerdict(status);
  return verdict.go ? { ok: true, document } : { ok: false, ...verdict };
}

const stamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');

/** A folder name from the connection target: host and client, lowercased, every other character `-`. */
export function systemFolder(
  url: string | undefined,
  client: string | undefined,
): string {
  let host = 'unknown-system';
  try {
    if (url) host = new URL(url).host;
  } catch {
    host = url ?? host;
  }
  const raw = `${host}${client ? `-${client}` : ''}`.toLowerCase();
  let name = '';
  for (const char of raw) name += /[a-z0-9._-]/.test(char) ? char : '-';
  return name;
}

/**
 * The default output folder, as the auth chain keeps its sessions: on Linux
 * and macOS `~/.config/mcp-abap-adt-clients/header-probe/<system>`, on
 * Windows `<home>\Documents\mcp-abap-adt-clients\header-probe\<system>`.
 * Persistent and local: never committed.
 */
export function defaultOutputDir(target: {
  platform: NodeJS.Platform;
  home: string;
  url?: string | undefined;
  client?: string | undefined;
}): string {
  const join = target.platform === 'win32' ? path.win32.join : path.posix.join;
  const base =
    target.platform === 'win32'
      ? join(target.home, 'Documents')
      : join(target.home, '.config');
  return join(
    base,
    'mcp-abap-adt-clients',
    'header-probe',
    systemFolder(target.url, target.client),
  );
}

/**
 * Where a run writes: `--out`, else {@link defaultOutputDir} for the
 * connection target in `SAP_URL` / `SAP_CLIENT`. Absolute; created when
 * missing.
 */
export function outputDir(given?: string): string {
  const dir = path.resolve(
    given ??
      defaultOutputDir({
        platform: process.platform,
        home: os.homedir(),
        url: process.env.SAP_URL?.split('#')[0].trim(),
        client: process.env.SAP_CLIENT?.split('#')[0].trim(),
      }),
  );
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeCorpus(corpus: ICorpus, outDir: string): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(
    outDir,
    `corpus-${corpus.source}-${corpus.headers}${corpus.phase ? `-phase${corpus.phase}` : ''}-${stamp()}`,
  );
  fs.writeFileSync(`${base}.json`, `${JSON.stringify(corpus, null, 2)}\n`);
  fs.writeFileSync(`${base}.md`, renderCorpusMarkdown(corpus));
  return [`${base}.json`, `${base}.md`];
}

export interface ICorpusRunInput {
  /** The connection, already open (tests). The run puts it behind its gate. */
  connection?: IAbapConnection;
  /**
   * Opens the connection: its logon is the first request of the run, and a
   * 401 or 403 there is the Oops.
   */
  open?: () => Promise<IAbapConnection>;
  /** Releases what `open` opened. */
  close?: (connection: IAbapConnection) => Promise<void>;
  source: Source;
  mode: HeadersMode;
  interrupt: Interrupt;
  outDir: string;
  /** Read after the discovery read, on the gate: on cloud it asks the system. */
  clientOptions: (connection: IAbapConnection) => Promise<ClientOptions>;
  out: IOutput;
  /** Every request one at a time, no envelope. */
  sequential?: boolean;
  /** Keep only the endpoints whose `handler.member` or href contains one of these. */
  only?: string[];
  /**
   * Leave out the endpoints whose `handler.member` or href contains one of
   * these (`--except`): never sent, never counted, never tried on an object.
   */
  except?: string[];
  /**
   * An authorization 403 of this user (not a CSRF one, not the first
   * discovery read) is recorded and the run goes on; any 401, a CSRF 403 and
   * the logon still stop it (`--record-unauthorized`).
   */
  recordUnauthorized?: boolean;
  /** The calls an earlier run's split found poisoning envelopes (`--isolate`): each is sent alone from the start. */
  isolate?: ReadonlySet<string>;
  /** Probes per envelope ({@link ENVELOPE_PROBES} unless given). */
  envelopeProbes?: number;
  /**
   * Where the clients run makes its temporary objects: the members that work
   * on an object run on them. Without it they run on the probe name.
   */
  temporaryObjects?: ITemporaryContext;
}

/** What the run met: the record the end decides the exit from. */
export interface IRunState {
  /** The authorization stop (a logon refusal included). */
  stop?: IAuthStop;
  /** Any other failure: a failed discovery read, an error the run met. */
  failure?: string;
  /** `--record-unauthorized`: the endpoints recorded as not authorized, each once. */
  unauthorized?: Set<string>;
}

/** What ended the run, as its reports say it. */
export function endedBy(state: IRunState, interrupt: Interrupt): string {
  if (interrupt.reason === 'sigint') return 'interrupted (SIGINT)';
  if (state.stop)
    return `stopped: authorization (${state.stop.status}, ${state.stop.kind}) at ${state.stop.endpoint}`;
  if (state.failure) return `failed: ${state.failure}`;
  return 'complete';
}

/**
 * The exit code, decided here and nowhere else, from what the run met:
 * Ctrl-C 130, an authorization stop 2, any other failure 1, else 0.
 */
export function exitCodeOf(state: IRunState, interrupt: Interrupt): number {
  if (interrupt.reason === 'sigint') return 130;
  if (state.stop) return 2;
  if (state.failure) return 1;
  return 0;
}

/**
 * Per gated connection, how to end its session and open a new one: what
 * frees a lock whose handle never came back.
 */
const sessionsOf = new WeakMap<IAbapConnection, OwnSession>();

/** Runs `use` on a session of its own, ended after: what frees a lock no handle came back for. */
export type OwnSession = (
  use: (connection: IAbapConnection) => Promise<void>,
) => Promise<void>;

/**
 * One run: the logon through the gate, the body on the gated connection,
 * the report — always written, marked with what ended the run —, the line
 * that says it, and the exit code from the run's state.
 */
async function runWith(
  input: Pick<
    ICorpusRunInput,
    | 'connection'
    | 'open'
    | 'close'
    | 'interrupt'
    | 'out'
    | 'recordUnauthorized'
  >,
  body: (connection: IAbapConnection, state: IRunState) => Promise<void>,
  report: (state: IRunState, ended: string) => string[],
): Promise<{ exitCode: number; files: string[]; state: IRunState }> {
  const state: IRunState = {};
  const auth = guardAuthorization(
    input.interrupt,
    (stop) => {
      state.stop ??= stop;
    },
    input.recordUnauthorized === true,
  );
  let raw = input.connection;
  try {
    if (!raw) {
      if (!input.open) throw new Error('the run needs a connection or open()');
      raw = await gateConnect(input.open, input.interrupt);
    }
    const gated = gate(raw, { interrupt: input.interrupt });
    const { open, close } = input;
    if (open && close && !input.connection)
      sessionsOf.set(gated, async (use) => {
        // A session of its own, through the gate, closed after: the logoff
        // ends it and every lock it held (measured).
        const own = await gateConnect(open, input.interrupt);
        try {
          await use(gate(own, { interrupt: input.interrupt }));
        } finally {
          await close(own);
        }
      });
    await body(gated, state);
  } catch (error) {
    if (error instanceof LogonRefused)
      state.stop ??= { status: error.status, kind: 'logon', endpoint: 'logon' };
    else if (!(error instanceof Interrupted)) {
      state.failure ??= message(error);
      input.out.loud(`The run stopped: ${state.failure}`);
    }
  } finally {
    auth.release();
  }
  let files: string[] = [];
  try {
    files = report(state, endedBy(state, input.interrupt));
  } finally {
    if (raw && input.close && !input.connection) await input.close(raw);
  }
  if (state.unauthorized?.size)
    input.out.progress(
      `${state.unauthorized.size} endpoint(s) not authorized for this user — recorded, not judged`,
    );
  if (state.stop && input.interrupt.reason !== 'sigint')
    input.out.progress(
      state.stop.kind === 'logon'
        ? `Oops: no authorization (${state.stop.status})`
        : authorizationLine(state.stop),
    );
  return { exitCode: exitCodeOf(state, input.interrupt), files, state };
}

const newCorpus = (
  input: Pick<
    ICorpusRunInput,
    'source' | 'mode' | 'sequential' | 'only' | 'except' | 'recordUnauthorized'
  >,
): ICorpus => ({
  source: input.source,
  headers: input.mode,
  startedAt: new Date().toISOString(),
  rows: [],
  removals: [],
  envelopes: [],
  ...(input.sequential ? { sequential: true } : {}),
  ...(input.only?.length ? { only: input.only } : {}),
  ...(input.except?.length ? { except: input.except } : {}),
  ...(input.recordUnauthorized ? { recordUnauthorized: true as const } : {}),
});

/** Marks a corpus with what ended it, and writes it. */
function finishCorpus(
  corpus: ICorpus,
  ended: string,
  input: Pick<ICorpusRunInput, 'outDir' | 'out'>,
): string[] {
  corpus.endedBy = ended;
  if (ended !== 'complete') corpus.error = ended;
  corpus.finishedAt = new Date().toISOString();
  const files = writeCorpus(corpus, input.outDir);
  for (const file of files) input.out.progress(file);
  return files;
}

/**
 * The run of one source in one headers mode: the logon, the discovery read,
 * every probe, the cleanup in a `finally`, and the two files.
 */
export async function runCorpus(
  input: ICorpusRunInput,
): Promise<{ exitCode: number; files: string[]; corpus: ICorpus }> {
  let result: { corpus: ICorpus; files: string[] } | undefined;
  const { exitCode, files } = await runWith(
    input,
    async (connection, state) => {
      result = await runOn(connection, input, state);
    },
    (_state, ended) => {
      if (result) return result.files;
      // Nothing ran (the logon was refused, or Ctrl-C came first): the
      // report still says so.
      const corpus = newCorpus(input);
      result = { corpus, files: finishCorpus(corpus, ended, input) };
      return result.files;
    },
  );
  return { exitCode, files, corpus: result?.corpus ?? newCorpus(input) };
}

/**
 * One source in one mode on the gated connection. It records what it met
 * in `state`; it never decides the exit.
 */
async function runOn(
  connection: IAbapConnection,
  input: ICorpusRunInput,
  state: IRunState,
): Promise<{ corpus: ICorpus; files: string[] }> {
  const { out } = input;
  const corpus = newCorpus(input);
  const discovery = await readDiscovery(connection);
  if (!discovery.ok) {
    if (!state.stop) {
      state.failure ??= `${discovery.line} (${input.source} ${input.mode})`;
      out.progress(discovery.line);
    }
    return {
      corpus,
      files: finishCorpus(corpus, endedBy(state, input.interrupt), input),
    };
  }
  const meter: IMeter = { envelopes: corpus.envelopes as IEnvelopeTiming[] };
  const registered = new Set<string>();
  const failures: string[] = [];
  const ledger = new Ledger((removal: IRemoval) => {
    corpus.removals.push(removal);
    out.progress(`  cleanup: ${removalWord(removal)} ${removal.label}`);
  });
  try {
    const ctx: IContext = {
      connection,
      mode: input.mode,
      interrupt: input.interrupt,
      ledger,
      corpus,
      clientOptions: await input.clientOptions(connection),
      out,
      meter,
      sequential: input.sequential === true,
      ...(input.only ? { only: input.only } : {}),
      ...(input.except ? { except: input.except } : {}),
      envelopeProbes: input.envelopeProbes ?? ENVELOPE_PROBES,
      ...(input.isolate ? { isolate: input.isolate } : {}),
      register: (key, entry) => {
        if (registered.has(key)) return;
        registered.add(key);
        ledger.add(entry());
      },
      ...(input.temporaryObjects && input.source === 'clients'
        ? { temporary: input.temporaryObjects }
        : {}),
      ...(sessionsOf.get(connection)
        ? { ownSession: sessionsOf.get(connection) }
        : {}),
      failures,
    };
    await withCleanup(ledger, () =>
      input.source === 'discovery'
        ? runDiscovery(ctx, discovery.document)
        : runClients(ctx),
    );
  } catch (error) {
    if (!(error instanceof Interrupted)) {
      state.failure ??= message(error);
      out.loud(`The run stopped: ${message(error)}`);
    }
  }
  if (failures.length)
    state.failure ??= `temporary objects: ${failures.join('; ')}`;
  // No temporary object may be left behind: the run ends failed. (What a
  // write on the probe name made is reported as before, `clients: …`.)
  const remaining = unproven(corpus.removals).filter(
    (removal) => !removal.label.startsWith('clients: '),
  );
  if (input.source === 'clients' && remaining.length)
    state.failure ??= `${remaining.length} object(s) may remain: ${remaining.map((removal) => removal.label).join(', ')}`;
  if (input.recordUnauthorized) {
    corpus.unauthorized = markUnauthorized(corpus.rows);
    for (const endpoint of corpus.unauthorized)
      (state.unauthorized ??= new Set()).add(endpoint);
  }
  if (input.mode === 'bogus') corpus.needs = classifyNeeds(corpus.rows);
  const files = finishCorpus(corpus, endedBy(state, input.interrupt), input);
  // A temporary object is there after a write by design; the probe name is not.
  const created = corpus.rows.filter(
    (row) => row.afterWrite?.exists === true && !row.temporary,
  );
  if (created.length) {
    out.loud(`\n!!! ${created.length} write probe(s) created the probe name:`);
    for (const row of created)
      out.loud(
        `!!!   ${row.group} ${row.label}: ${row.endpoint?.method} ${row.endpoint?.path}`,
      );
  }
  const left = unproven(corpus.removals);
  if (left.length) {
    out.loud(
      `\n!!! ${left.length} object(s) could not be removed or may remain — check and delete them by hand:`,
    );
    for (const removal of left)
      out.loud(
        `!!!   ${removalWord(removal)} ${removal.label}: ${removal.detail}`,
      );
  }
  return { corpus, files };
}

// --- the full run: one command, the system's header corpus -------------------

export interface IWriteCycleInput {
  connection: IAbapConnection;
  clientOptions: ClientOptions;
  interrupt: Interrupt;
  /** The needs keys (`handler.member — endpoint`) of the writes still unknown. */
  unknown: ReadonlySet<string>;
  /** `--only` / `--except` of the run: an endpoint they exclude is not sent. */
  filter?: IEndpointFilter;
}

export interface IWriteCycleResult {
  evidence: IEvidence[];
  /** The cycle's answers as rows, for `exists`. */
  rows?: ICorpusRow[];
  removals: IRemoval[];
  error?: string;
}

export interface IFullRunInput
  extends Omit<ICorpusRunInput, 'source' | 'mode'> {
  /**
   * Phase 2's writes: the temporary-object cycle for the write members still
   * unknown. Given by the command line, which holds the test config.
   */
  writeCycle?: (input: IWriteCycleInput) => Promise<IWriteCycleResult>;
  /**
   * Phase 2's update measurement: per object type, an update with a bogus
   * Accept on a temporary object, and whether it took effect.
   */
  updateMeasure?: (input: Omit<IWriteCycleInput, 'unknown'>) => Promise<{
    updates: IHeaderCorpusFile['updates'];
    removals: IRemoval[];
    rows?: ICorpusRow[];
    error?: string;
  }>;
}

const PHASE1: readonly { source: Source; mode: HeadersMode }[] = [
  { source: 'discovery', mode: 'corpus' },
  { source: 'discovery', mode: 'none' },
  { source: 'discovery', mode: 'bogus' },
  { source: 'clients', mode: 'corpus' },
  { source: 'clients', mode: 'none' },
  { source: 'clients', mode: 'bogus' },
];

/**
 * The full run: the logon and the discovery read; phase 1, every source in
 * every mode on the probe name; phase 2, for the endpoints still unknown
 * only, existing objects for the reads and the temporary-object cycle for
 * the writes; then one header corpus file, with each phase's time — always
 * written, marked with what ended the run.
 */
export async function runFull(
  input: IFullRunInput,
): Promise<{ exitCode: number; files: string[]; file?: IHeaderCorpusFile }> {
  const started = performance.now();
  const startedAt = new Date().toISOString();
  const { out } = input;
  const phases: IHeaderCorpusFile['phases'] = [];
  const files: string[] = [];
  const corpora = new Map<string, ICorpus>();
  const evidence: IEvidence[] = [];
  let removals: IRemoval[] = [];
  let file: IHeaderCorpusFile | undefined;
  const phase2Rows: ICorpusRow[] = [];
  let updates: IHeaderCorpusFile['updates'] = [];
  const rowsOf = (key: string) => corpora.get(key)?.rows ?? [];
  const filter: IEndpointFilter = {
    ...(input.only ? { only: input.only } : {}),
    ...(input.except ? { except: input.except } : {}),
  };

  const unauthorized = new Set<string>();
  /** Phase 2's rows: an authorization 403 is recorded, never judged. */
  const noteUnauthorized = (rows: readonly ICorpusRow[]) => {
    if (!input.recordUnauthorized) return;
    for (const endpoint of markUnauthorized(rows)) unauthorized.add(endpoint);
  };
  const withoutUnauthorized = (items: readonly IEvidence[]): IEvidence[] =>
    items.filter((item) => !unauthorized.has(item.endpoint));

  const body = async (connection: IAbapConnection, state: IRunState) => {
    const stopped = () =>
      Boolean(state.stop) ||
      Boolean(state.failure) ||
      input.interrupt.requested;
    const timed = async (name: string, run: () => Promise<void>) => {
      const at = performance.now();
      try {
        await run();
      } catch (thrown) {
        // A stop inside a phase ends the phase; the run's state says why.
        if (!(thrown instanceof Interrupted)) throw thrown;
      } finally {
        phases.push({ name, ms: performance.now() - at });
      }
    };
    const authorized = await readDiscovery(connection);
    if (!authorized.ok) {
      if (!state.stop) {
        state.failure ??= authorized.line;
        out.progress(authorized.line);
      }
      return;
    }
    await timed('phase 1: the probe name, every source and mode', async () => {
      for (const { source, mode } of PHASE1) {
        if (stopped()) break;
        out.progress(`phase 1: ${source} ${mode}`);
        const result = await runOn(
          connection,
          { ...input, source, mode },
          state,
        );
        files.push(...result.files);
        for (const endpoint of result.corpus.unauthorized ?? [])
          unauthorized.add(endpoint);
        for (const row of result.corpus.rows) row.headersMode = mode;
        corpora.set(`${source} ${mode}`, result.corpus);
      }
    });
    const needs1 = {
      // The none and the corpus answers: evidence beside the bogus ones.
      discovery: classifyNeeds(rowsOf('discovery bogus'), [
        ...rowsOf('discovery none'),
        ...rowsOf('discovery corpus'),
      ]),
      clients: classifyNeeds(rowsOf('clients bogus'), [
        ...rowsOf('clients none'),
        ...rowsOf('clients corpus'),
      ]),
    };
    evidence.push(
      ...evidenceOf(needs1.discovery, 'discovery', 1),
      ...evidenceOf(needs1.clients, 'clients', 1),
    );
    const unknown = needs1.clients.filter((entry) => entry.needs === 'unknown');
    const unknownWrites = new Set(
      unknown
        .filter((entry) => /— (POST|PUT|DELETE) /.test(entry.endpoint))
        .map((entry) => entry.endpoint),
    );
    const cycle = input.writeCycle;
    if (!stopped() && unknownWrites.size && cycle)
      await timed(
        `phase 2: writes on temporary objects (${unknownWrites.size} unknown)`,
        async () => {
          const writes = await cycle({
            connection,
            clientOptions: await input.clientOptions(connection),
            interrupt: input.interrupt,
            unknown: unknownWrites,
            filter,
          });
          phase2Rows.push(...(writes.rows ?? []));
          noteUnauthorized(writes.rows ?? []);
          evidence.push(...withoutUnauthorized(writes.evidence));
          removals = [...removals, ...writes.removals];
          if (writes.error) state.failure ??= writes.error;
        },
      );
    const measure = input.updateMeasure;
    if (!stopped() && measure)
      await timed(
        'phase 2: updates with a bogus Accept, applied or not',
        async () => {
          const measured = await measure({
            connection,
            clientOptions: await input.clientOptions(connection),
            interrupt: input.interrupt,
            filter,
          });
          updates = measured.updates;
          phase2Rows.push(...(measured.rows ?? []));
          noteUnauthorized(measured.rows ?? []);
          // Each update went with a bogus Accept: evidence for its Accept.
          for (const row of measured.rows ?? [])
            if (row.endpoint && !row.unauthorized)
              evidence.push({
                endpoint: endpointKey(row.endpoint),
                source: 'clients',
                phase: 2,
                who: `${row.group}.${row.label} (update measurement, temporary object)`,
                accept: judge(row, 406),
                contentType: {
                  verdict: 'unknown',
                  reason: 'not probed by the update measurement',
                },
                namedAccept: [],
                namedContentType: [],
                text: `bogus Accept: ${row.status ?? row.failure ?? 'no answer'}${row.sapType ? ` ${row.sapType}` : ''}`,
              });
          removals = [...removals, ...measured.removals];
          if (measured.error) state.failure ??= measured.error;
        },
      );
  };

  const report = (state: IRunState, ended: string): string[] => {
    for (const endpoint of unauthorized)
      (state.unauthorized ??= new Set()).add(endpoint);
    const discoveryContentType = new Map<string, string[]>();
    for (const collection of corpora.get('discovery corpus')?.collections ?? [])
      if (collection.accept.length)
        discoveryContentType.set(`POST ${collection.href}`, collection.accept);
    const pairs = new Map<string, string[]>();
    for (const row of rowsOf('clients corpus')) {
      if (!row.endpoint || !row.pair) continue;
      const key = endpointKey(row.endpoint);
      const text = `${row.group}.${row.label}: ${[
        row.pair.accept ? `Accept ${row.pair.accept}` : '',
        row.pair.contentType ? `Content-Type ${row.pair.contentType}` : '',
      ]
        .filter(Boolean)
        .join(', ')}`;
      pairs.set(key, [...new Set([...(pairs.get(key) ?? []), text])]);
    }
    const existence = existencePerEndpoint([
      ...[...corpora.values()].flatMap((corpus) => corpus.rows),
      ...phase2Rows,
    ]);
    // What the client sends today, and what it got: the corpus-mode answers
    // of phase 1 (the probe name) and phase 2 (an existing object).
    const knownWorking = new Map<string, string[]>();
    for (const row of [...rowsOf('clients corpus'), ...phase2Rows]) {
      if (row.headersMode !== 'corpus' || !row.endpoint || row.skipped)
        continue;
      const accept = row.onWire[0]?.accept;
      if (!accept) continue;
      const key = endpointKey(row.endpoint);
      const status = row.status ?? 'no answer';
      const text = `${row.group}.${row.label}: Accept ${accept} → ${status}${row.status !== undefined && row.status >= 200 && row.status < 300 ? ' (works)' : ''}`;
      knownWorking.set(key, [
        ...new Set([...(knownWorking.get(key) ?? []), text]),
      ]);
    }
    const workingContentType = workingContentTypes([
      ...[...corpora.values()]
        .filter((corpus) => corpus.source === 'clients')
        .flatMap((corpus) => corpus.rows),
      ...phase2Rows,
    ]);
    const extras = {
      discoveryContentType,
      pairs,
      existence,
      knownWorking,
      workingContentType,
    };
    // The contrast rule: an unnamed 406 is checked when another Accept got a
    // 2xx or a 404 on the endpoint — from any source and phase, keyed by the
    // endpoint. Phase 1's own count takes phase 1's rows only.
    const phase1Rows = [...corpora.values()].flatMap((corpus) => corpus.rows);
    const phase1 = withContrast(
      evidence.filter((item) => item.phase === 1),
      phase1Rows,
    );
    const contrasted = withContrast(evidence, phase1Rows, phase2Rows);
    const entries = buildHeaderCorpus(contrasted, extras);
    file = {
      startedAt,
      finishedAt: new Date().toISOString(),
      phases,
      totalMs: performance.now() - started,
      counts: {
        phase1: needsCounts(buildHeaderCorpus(phase1, extras)),
        phase2: needsCounts(entries),
      },
      entries,
      selfCheck: selfCheck(entries),
      corpora: [...files],
      // Every object a run made, the probe name's and the temporary ones.
      removals: [
        ...[...corpora.values()]
          .filter((corpus) => corpus.source === 'clients')
          .flatMap((corpus) => corpus.removals),
        ...removals,
      ],
      objects: [...corpora.values()].flatMap((corpus) =>
        (corpus.temporaryObjects ?? []).map((object) => ({
          handler: `clients ${corpus.headers}`,
          ...object,
        })),
      ),
      ...(corpora.get('clients corpus')?.coverage
        ? { coverage: corpora.get('clients corpus')?.coverage }
        : {}),
      updates,
      endedBy: ended,
      ...(input.only?.length ? { only: input.only } : {}),
      ...(input.except?.length ? { except: input.except } : {}),
      ...(input.recordUnauthorized
        ? { recordUnauthorized: true as const, unauthorized: [...unauthorized] }
        : {}),
      ...(ended !== 'complete' ? { error: ended } : {}),
    };
    fs.mkdirSync(input.outDir, { recursive: true });
    const base = path.join(input.outDir, `header-corpus-${stamp()}`);
    fs.writeFileSync(`${base}.json`, `${JSON.stringify(file, null, 2)}\n`);
    fs.writeFileSync(`${base}.md`, renderHeaderCorpus(file));
    for (const written of [`${base}.json`, `${base}.md`]) out.progress(written);
    const left = unproven(removals);
    if (left.length) {
      out.loud(
        `\n!!! ${left.length} temporary object(s) could not be removed or may remain — check and delete them by hand:`,
      );
      for (const removal of left)
        out.loud(
          `!!!   ${removalWord(removal)} ${removal.label}: ${removal.detail}`,
        );
    }
    return [...files, `${base}.json`, `${base}.md`];
  };

  const result = await runWith(input, body, report);
  return {
    exitCode: result.exitCode,
    files: result.files,
    ...(file ? { file } : {}),
  };
}
