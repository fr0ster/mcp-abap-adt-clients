/**
 * One run of the error corpus on a connection it is given: the authorization
 * check, the probes of one source in one headers mode, the cleanup, the two
 * files. The command line, the session and Ctrl-C are errorCorpus.ts's.
 */

import * as fs from 'node:fs';
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
  type ICallOn,
  type ICapture,
  type IEnvelopeTiming,
  type IMeter,
  message,
  runCalls,
  traced,
} from './capture';
import {
  askedFor,
  authorizationVerdict,
  type BogusHeader,
  bogusHeaders,
  classifyNeeds,
  contentTypeNotSent,
  discoveryProbes,
  dumpText,
  emptyNamed,
  FIXED_TEXT,
  fakeBody,
  type HeadersMode,
  headerShape,
  type ICorpus,
  type ICorpusRow,
  type IDiscoveryProbe,
  isWrite,
  PROBE_NAME,
  parseDiscovery,
  readCorpusAnswer,
  renderCorpusMarkdown,
  type Source,
  wireNote,
  writeCheck,
} from './corpus';
import { type Interrupt, Interrupted, Ledger, withCleanup } from './ledger';
import {
  clientsOn,
  handlerSpecs,
  type IClients,
  type IMemberEndpoint,
  pairOf,
  recordMembers,
  UNIVERSAL,
} from './members';
import { type IRemoval, PROBE_TYPE } from './record';

/** How many probes go in one envelope (each write probe brings its read). */
export const ENVELOPE_PROBES = 25;

type ClientOptions = ConstructorParameters<typeof AdtClient>[2];

/** The status a failed request carries, if any. */
export const statusOfError = (error: unknown): number | undefined => {
  const candidate = error as {
    response?: { status?: unknown };
    status?: unknown;
  };
  const status = candidate?.response?.status ?? candidate?.status;
  return typeof status === 'number' ? status : undefined;
};

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
    const captures = await runCalls({
      calls,
      batched,
      connection: this.connection,
      direct: this.direct,
      onBatch: this.onBatch,
      interrupt: this.interrupt,
      meter: this.meter,
    });
    let at = 0;
    for (const entry of planned) {
      const probe = captures[at++];
      const read = entry.read ? captures[at++] : undefined;
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
    const chunks = Math.ceil(batchable.length / ENVELOPE_PROBES);
    for (let chunk = 0; chunk < chunks; chunk++) {
      this.interrupt.check();
      const part = batchable.slice(
        chunk * ENVELOPE_PROBES,
        (chunk + 1) * ENVELOPE_PROBES,
      );
      this.out.progress(
        `  envelope ${chunk + 1}/${chunks}: ${part.length} probes`,
      );
      await this.send(part, true, () => 'batched');
      // The envelope itself was refused, or one part's dump answered for
      // every part (measured: all parts of an envelope got the same 500
      // page, while each sent alone got its own answer): one by one.
      const failed = part.filter(
        (entry) =>
          entry.row.status === undefined &&
          (entry.row.failure ?? '').startsWith('the envelope failed'),
      );
      const poisoned =
        part.length > 1 && part.every((entry) => entry.row.status === 500);
      if (poisoned || (failed.length && failed.length === part.length)) {
        const first = part[0].row;
        const envelopeId = first.envelope ?? '?';
        const said = first.sapMessage ?? dumpText(first.body);
        const why = poisoned
          ? `every part of envelope ${envelopeId} answered the same 500${said ? `: ${said}` : ''}`
          : `the envelope carrying it failed (${first.failure ?? ''})`;
        this.out.progress(`  ${why}; its ${part.length} probes go one by one`);
        for (const entry of part) {
          entry.row.inEnvelope = poisoned
            ? `500 in envelope ${envelopeId}`
            : (entry.row.failure ?? 'failed');
          resetAnswer(entry.row);
        }
        await this.send(part, false, () => `sequential: ${why}`);
      }
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
): () => Promise<{ removed: boolean; detail: string }> {
  const read = () =>
    statusOf(
      connection.makeAdtRequest({
        url: uri,
        method: 'GET',
        timeout: 0,
        headers: { Accept: '*/*' },
      }),
    );
  return async () => {
    if ((await read()) === 404)
      return { removed: true, detail: 'not there any more' };
    const headers = pairOf('getUtils()', 'deleteObjectsGroup') as IAdtHeaders;
    const body = `<?xml version="1.0" encoding="UTF-8"?><del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">\n  <del:object adtcore:uri="${uri}">\n    <del:transportNumber/>\n  </del:object>\n</del:deletionRequest>`;
    const deleted = await statusOf(
      connection.makeAdtRequest({
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
    const after = await read();
    return after === 404
      ? { removed: true, detail: `deleted (${deleted ?? 'no status'})` }
      : {
          removed: false,
          detail: `the deletion answered ${deleted ?? 'nothing'}; ${uri} still reads ${after ?? 'unknown'}`,
        };
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
}

/** Where the calls go: the connection (or the envelope), and whether it is an envelope. */
interface ITarget {
  base: IAbapConnection;
  parts: boolean;
}

async function runDiscovery(ctx: IContext, document: string): Promise<void> {
  const collections = parseDiscovery(document);
  ctx.corpus.collections = collections;
  const only = ctx.only;
  const probes = discoveryProbes(collections, ctx.mode).filter(
    (probe) =>
      !only || only.some((text) => probe.collection.href.includes(text)),
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
    const entry: IPlanned<ITarget> = {
      row,
      call: (on, analyse) =>
        answered(
          traced(on.base, {
            shape: headerShape(ctx.mode, on.parts, probe.bogus),
            parts: on.parts,
          }).makeAdtRequest({
            url: collection.href,
            method: probe.method,
            timeout: 0,
            ...(probe.body !== undefined ? { data: probe.body } : {}),
            headers: headersOf(probe.asked),
          }),
          analyse,
        ),
    };
    if (isWrite(probe.method)) {
      entry.read = (on, analyse) =>
        answered(
          traced(on.base, { parts: on.parts }).makeAdtRequest({
            url: uri,
            method: 'GET',
            timeout: 0,
            headers: { Accept: '*/*' },
          }),
          analyse,
        );
      entry.after = () => {
        if (row.afterWrite?.exists !== true) return;
        ctx.out.loud(`!!! ${probe.method} ${collection.href} created ${uri}`);
        ctx.ledger.add({
          label: `discovery: ${uri} (after ${probe.method} ${collection.href})`,
          remove: discoveryRemoval(ctx.connection, uri),
        });
      };
    }
    return entry;
  });
  ctx.corpus.rows.push(...planned.map((entry) => entry.row));
  for (const [index, probe] of probes.entries())
    if (probe.skipped) planned[index].row.skipped = probe.skipped;
  const sent = planned.filter((_entry, index) => !probes[index].skipped);
  await new Run<ITarget>(
    ctx.connection,
    ctx.mode,
    { base: ctx.connection, parts: false },
    (batch) => ({ base: batch, parts: true }),
    ctx.interrupt,
    ctx.out,
    ctx.meter,
    ctx.sequential,
  ).all(sent);
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
  const only = ctx.only;
  const members = recorded.members.filter(
    (member) =>
      !only ||
      only.some((text) => `${member.handler}.${member.member}`.includes(text)),
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
  const once = (call: ICallOn<ITarget>) =>
    runCalls({
      calls: [call],
      batched: false,
      connection: ctx.connection,
      direct,
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
  for (const member of members) {
    const spec = specs.get(member.handler);
    const call = member.call;
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
        call: (on, analyse) =>
          call(handlerOf(clientsAt(on, bogus)) as never, { headers, analyse }),
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
        if (row.afterWrite?.exists === true) {
          ctx.out.loud(`!!! ${label} created ${PROBE_NAME}`);
          ctx.ledger.add({
            label: `clients: ${member.handler} ${PROBE_NAME} (after ${member.member})`,
            remove: clientsRemoval(
              once,
              (on) => handlerOf(clientsAt(on, undefined, true)),
              handlerOf(reference),
              member.handler,
            ),
          });
        }
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
      planned.push(entry);
    }
  }
  await new Run<ITarget>(
    ctx.connection,
    ctx.mode,
    direct,
    onBatch,
    ctx.interrupt,
    ctx.out,
    ctx.meter,
    ctx.sequential,
  ).all(planned);
}

/** Removes the probe object a member's write created: the handler's delete, then a read. */
function clientsRemoval(
  once: (call: ICallOn<ITarget>) => Promise<ICapture>,
  handlerAt: (on: ITarget) => IHandler,
  reference: IHandler,
  handler: string,
): () => Promise<{ removed: boolean; detail: string }> {
  const read = () =>
    once((on, analyse) =>
      Promise.resolve(handlerAt(on).readMetadata(UNIVERSAL, { analyse })),
    );
  return async () => {
    if ((await read()).wire?.status === 404)
      return { removed: true, detail: 'not there any more' };
    const pair = pairOf(handler, 'delete');
    if (
      !pair?.accept ||
      !pair.contentType ||
      typeof reference.delete !== 'function'
    )
      return { removed: false, detail: `${handler} has no delete with a pair` };
    const headers = { accept: pair.accept, contentType: pair.contentType };
    const deleted = await once((on, analyse) =>
      Promise.resolve(handlerAt(on).delete(UNIVERSAL, { headers, analyse })),
    );
    const after = await read();
    return after.wire?.status === 404
      ? {
          removed: true,
          detail: `deleted (${deleted.wire?.status ?? 'no status'})`,
        }
      : {
          removed: false,
          detail: `the delete answered ${deleted.wire?.status ?? deleted.failure}; the object still reads ${after.wire?.status ?? 'unknown'}`,
        };
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
    const wire = await connection.makeAdtRequest({
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

export function writeCorpus(corpus: ICorpus, outDir: string): string[] {
  fs.mkdirSync(outDir, { recursive: true });
  const base = path.join(
    outDir,
    `corpus-${corpus.source}-${corpus.headers}-${stamp()}`,
  );
  fs.writeFileSync(`${base}.json`, `${JSON.stringify(corpus, null, 2)}\n`);
  fs.writeFileSync(`${base}.md`, renderCorpusMarkdown(corpus));
  return [`${base}.json`, `${base}.md`];
}

export interface ICorpusRunInput {
  connection: IAbapConnection;
  source: Source;
  mode: HeadersMode;
  interrupt: Interrupt;
  outDir: string;
  /** Read after the authorization check: on cloud it asks the system. */
  clientOptions: () => Promise<ClientOptions>;
  out: IOutput;
  /** Every request one at a time, no envelope. */
  sequential?: boolean;
  /** Keep only the endpoints whose `handler.member` or href contains one of these. */
  only?: string[];
}

/**
 * The run: the authorization check first — 401 or 403 prints the Oops and
 * sends nothing more —, then every probe, the cleanup in a `finally`, and
 * the two files.
 */
export async function runCorpus(
  input: ICorpusRunInput,
): Promise<{ exitCode: number; files: string[]; corpus?: ICorpus }> {
  const { connection, out } = input;
  const discovery = await readDiscovery(connection);
  if (!discovery.ok) {
    out.progress(discovery.line);
    return { exitCode: discovery.exitCode, files: [] };
  }
  const corpus: ICorpus = {
    source: input.source,
    headers: input.mode,
    startedAt: new Date().toISOString(),
    rows: [],
    removals: [],
    envelopes: [],
    ...(input.sequential ? { sequential: true } : {}),
  };
  const meter: IMeter = { envelopes: corpus.envelopes as IEnvelopeTiming[] };
  const ledger = new Ledger((removal: IRemoval) => {
    corpus.removals.push(removal);
    out.progress(
      `  cleanup: ${removal.removed ? 'removed' : 'NOT REMOVED'} ${removal.label}`,
    );
  });
  try {
    const ctx: IContext = {
      connection,
      mode: input.mode,
      interrupt: input.interrupt,
      ledger,
      corpus,
      clientOptions: await input.clientOptions(),
      out,
      meter,
      sequential: input.sequential === true,
      ...(input.only ? { only: input.only } : {}),
    };
    await withCleanup(ledger, () =>
      input.source === 'discovery'
        ? runDiscovery(ctx, discovery.document)
        : runClients(ctx),
    );
  } catch (error) {
    if (!(error instanceof Interrupted)) {
      corpus.error = message(error);
      out.loud(`The run stopped: ${corpus.error}`);
    }
  }
  if (input.interrupt.requested) corpus.error = 'interrupted (SIGINT)';
  if (input.mode === 'bogus') corpus.needs = classifyNeeds(corpus.rows);
  corpus.finishedAt = new Date().toISOString();
  const files = writeCorpus(corpus, input.outDir);
  for (const file of files) out.progress(file);
  const created = corpus.rows.filter((row) => row.afterWrite?.exists === true);
  if (created.length) {
    out.loud(`\n!!! ${created.length} write probe(s) created the probe name:`);
    for (const row of created)
      out.loud(
        `!!!   ${row.group} ${row.label}: ${row.endpoint?.method} ${row.endpoint?.path}`,
      );
  }
  const left = corpus.removals.filter((removal) => !removal.removed);
  if (left.length) {
    out.loud(
      `\n!!! ${left.length} object(s) could not be removed — delete them by hand:`,
    );
    for (const removal of left)
      out.loud(`!!!   ${removal.label}: ${removal.detail}`);
  }
  return { exitCode: input.interrupt.requested ? 130 : 0, files, corpus };
}
