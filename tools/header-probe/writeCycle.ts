/**
 * Phase 2's writes: the header probe's temporary-object cycle, run only for
 * the object types whose write members phase 1 left unknown, with the bogus
 * Content-Type before the bogus Accept. Its ledger holds every object before
 * its create is sent; its locks are released in a `finally`; the state is
 * read after every write probe.
 */

import { createHash } from 'node:crypto';
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../../src/clients/AdtClient';
import { sapErrorIn } from '../../src/utils/adtErrors';
import type { ICapture } from './capture';
import type { ICorpusRow, IEvidence, IHeaderVerdict } from './corpus';
import { emptyNamed, judge } from './corpus';
import type { IWriteCycleInput, IWriteCycleResult } from './corpusRun';
import { Interrupted, Ledger, withCleanup, withLock } from './ledger';
import {
  type IObjectSpec,
  type ISpecContext,
  LOCAL_INCLUDES,
  OBJECT_SPECS,
} from './objects';
import { knownPair } from './pairs';
import { Probe, randomRun } from './probe';
import {
  endpointKey,
  endpointOf,
  type IOperationRow,
  type IProbeAnswer,
  type IRemoval,
  PROBE_TYPE,
} from './record';

/** The handler a probe row belongs to. */
export function handlerOfRow(objectType: string): string | undefined {
  if (objectType === 'messageClassMessage') return 'getMessageClassMessage()';
  if (objectType === 'utils') return 'getUtils()';
  return (
    OBJECT_SPECS.find((spec) => spec.type === objectType)?.handler ??
    LOCAL_INCLUDES.find((local) => local.type === objectType)?.handler
  );
}

/** The probe row type of a handler's members (a local include is its own). */
export function rowTypeOfHandler(handler: string): string | undefined {
  if (handler === 'getMessageClassMessage()') return 'messageClassMessage';
  if (handler === 'getUtils()') return 'utils';
  return (
    LOCAL_INCLUDES.find((local) => local.handler === handler)?.type ??
    OBJECT_SPECS.find((spec) => spec.handler === handler)?.type
  );
}

/** The probe's `--only` type that runs a handler's members. */
export function typeOfHandler(handler: string): string | undefined {
  if (handler === 'getMessageClassMessage()') return 'messageClass';
  if (handler === 'getUtils()') return 'utils';
  if (LOCAL_INCLUDES.some((local) => local.handler === handler)) return 'class';
  return OBJECT_SPECS.find((spec) => spec.handler === handler)?.type;
}

/** What one bad probe says about its header, judged as the corpus judges. */
export function verdictOf(
  answer: IProbeAnswer | undefined,
  refusal: 406 | 415,
): IHeaderVerdict {
  if (!answer) return { verdict: 'unknown', reason: 'not sent by the cycle' };
  return judge(
    {
      status: answer.status,
      sapType: answer.sapType,
      body: answer.body,
      failure: answer.failure,
    } as ICorpusRow,
    refusal,
  );
}

/** The evidence of the cycle's rows, for the wanted `handler.member` only. */
export function evidenceOfRows(
  rows: readonly IOperationRow[],
  wanted: ReadonlySet<string>,
): IEvidence[] {
  const evidence: IEvidence[] = [];
  for (const row of rows) {
    if (row.skipped) continue;
    const handler = handlerOfRow(row.objectType);
    if (!handler) continue;
    const who = `${handler}.${row.member}`;
    if (!wanted.has(who)) continue;
    const of = (kind: IProbeAnswer['probe']) =>
      row.probes.find((probe) => probe.probe === kind);
    const known = of('known') ?? row.probes[0];
    const request = known?.requests[known.requests.length - 1];
    if (!request) continue;
    const accept = verdictOf(of('badAccept'), 406);
    const contentType = verdictOf(of('badContentType'), 415);
    const text = (answer: IProbeAnswer | undefined) =>
      answer
        ? `${answer.status ?? 'no answer'}${answer.acceptedText ? ` ${answer.acceptedText}` : answer.sapMessage ? ` ${answer.sapMessage}` : ''}`
        : 'not sent';
    evidence.push({
      endpoint: endpointKey(request),
      source: 'clients',
      phase: 2,
      who: `${who} (${row.objectType}, temporary object)`,
      accept,
      contentType,
      namedAccept:
        of('badAccept')?.status === 406
          ? (of('badAccept')?.supportedAccept ?? [])
          : [],
      namedContentType:
        of('badContentType')?.status === 415
          ? (of('badContentType')?.supportedContentType ?? [])
          : [],
      text: `bogus Content-Type: ${text(of('badContentType'))} | bogus Accept: ${text(of('badAccept'))}`,
    });
  }
  return evidence;
}

/** The cycle's answers as corpus rows: for `exists` (and nothing else) beside phase 1's. */
export function rowsOfCycle(rows: readonly IOperationRow[]): ICorpusRow[] {
  const out: ICorpusRow[] = [];
  for (const row of rows)
    for (const answer of row.probes) {
      const request = answer.requests[answer.requests.length - 1];
      if (!request) continue;
      out.push({
        source: 'clients',
        group: handlerOfRow(row.objectType) ?? row.objectType,
        label: row.member,
        endpoint: request,
        requests: answer.requests,
        onWire: [],
        named: emptyNamed(),
        ...(answer.status !== undefined ? { status: answer.status } : {}),
        ...(answer.sapType ? { sapType: answer.sapType } : {}),
        ...(answer.body !== undefined ? { body: answer.body } : {}),
        ...(answer.failure ? { failure: answer.failure } : {}),
      });
    }
  return out;
}

/** The cycle, on the types the unknown writes belong to. */
export async function runWriteCycle(
  input: IWriteCycleInput & { packageName: string; transportRequest: string },
): Promise<IWriteCycleResult> {
  const wanted = new Set<string>();
  const types = new Set<string>();
  const members = new Set<string>();
  for (const key of input.unknown) {
    const who = key.slice(0, key.indexOf(' — '));
    if (who.startsWith('legacy ')) continue;
    const handler = who.slice(0, who.lastIndexOf('.'));
    const member = who.slice(who.lastIndexOf('.') + 1);
    const type = typeOfHandler(handler);
    const rowType = rowTypeOfHandler(handler);
    if (!type || !rowType) continue;
    wanted.add(who);
    types.add(type);
    members.add(`${rowType}.${member}`);
  }
  const removals: IRemoval[] = [];
  if (!types.size) return { evidence: [], removals };
  const ledger = new Ledger((removal) => removals.push(removal));
  const probe = new Probe(
    input.connection,
    input.clientOptions,
    // Probes only for the members still unknown; the cycle's prerequisites
    // (the create a write needs, with the known pair) run as before.
    {
      only: [...types],
      members: [...members],
      sequential: false,
      contentTypeFirst: true,
    },
    ledger,
    {
      packageName: input.packageName,
      transportRequest: input.transportRequest,
    },
    randomRun(),
    input.interrupt,
  );
  let error: string | undefined;
  try {
    await withCleanup(ledger, async () => {
      for (const spec of OBJECT_SPECS)
        if (types.has(spec.type)) await probe.objectType(spec);
      if (types.has('utils')) await probe.utils();
    });
  } catch (thrown) {
    if (!(thrown instanceof Interrupted))
      error = thrown instanceof Error ? thrown.message : String(thrown);
  }
  if (probe.lockFailures.length)
    error ??= `unlock failed: ${probe.lockFailures.join('; ')}`;
  return {
    evidence: evidenceOfRows(probe.rows, wanted),
    rows: rowsOfCycle(probe.rows),
    removals,
    ...(error ? { error } : {}),
  };
}

// --- the update measurement ------------------------------------------------

/** One object type's update, sent with a bogus Accept: did it take effect? */
export interface IUpdateMeasure {
  type: string;
  member: 'update' | 'updateMetadata';
  /** The update's answer. */
  status?: number;
  sapType?: string;
  /** Whether the content read after differs from the content read before (hashes only). */
  applied: boolean | 'unknown';
  note?: string;
}

/** The text a type's source takes as a comment line, appended to change it. */
export function changedSource(type: string, source: string): string {
  if (type === 'transformation')
    return `${source}\n<!-- error corpus update -->\n`;
  const ddlLike = [
    'structure',
    'table',
    'ddl',
    'serviceDefinition',
    'accessControl',
    'metadataExtension',
  ];
  if (ddlLike.includes(type)) return `${source}\n// error corpus update\n`;
  return `${source}\n* error corpus update\n`;
}

/** A metadata document with its description changed. */
export function changedMetadata(document: string): string {
  const marker = 'adtcore:description="';
  const at = document.indexOf(marker);
  if (at === -1) return document;
  const end = document.indexOf('"', at + marker.length);
  return `${document.slice(0, at + marker.length)}Error corpus updated${document.slice(end)}`;
}

/** A hash of content: what the measurement compares; the content itself is never kept. */
export const hashOf = (content: string): string =>
  createHash('sha256').update(content).digest('hex');

/**
 * Per object type of the write cycle, on a temporary object: create it,
 * read its content, send its update (source, or metadata) changed and with a
 * bogus Accept under a lock released in a `finally`, read the content again,
 * and compare the two hashes. The ledger holds the object before its create
 * is sent; the cleanup removes it.
 */
export async function measureUpdates(
  input: Omit<IWriteCycleInput, 'unknown'> & {
    packageName: string;
    transportRequest: string;
    /** The types to measure; all of the cycle's when absent. */
    only?: readonly string[];
  },
): Promise<{
  updates: IUpdateMeasure[];
  removals: IRemoval[];
  rows: ICorpusRow[];
  error?: string;
}> {
  const rows: ICorpusRow[] = [];
  const removals: IRemoval[] = [];
  const updates: IUpdateMeasure[] = [];
  const ledger = new Ledger((removal) => removals.push(removal));
  const context = {
    packageName: input.packageName,
    transportRequest: input.transportRequest,
  };
  const probe = new Probe(
    input.connection,
    input.clientOptions,
    { sequential: true },
    ledger,
    context,
    randomRun(),
    input.interrupt,
  );
  let error: string | undefined;
  const statusOf = (capture: ICapture) => capture.wire?.status;
  const okOf = (capture: ICapture) => {
    const status = statusOf(capture);
    return status !== undefined && status >= 200 && status < 300;
  };
  const bodyOf = (capture: ICapture) =>
    typeof capture.wire?.data === 'string' ? capture.wire.data : undefined;
  try {
    await withCleanup(ledger, async () => {
      for (const spec of OBJECT_SPECS) {
        if (input.only && !input.only.includes(spec.type)) continue;
        input.interrupt.check();
        const member = spec.write === 'source' ? 'update' : 'updateMetadata';
        const row: IUpdateMeasure = {
          type: spec.type,
          member,
          applied: 'unknown',
        };
        updates.push(row);
        const ctx: ISpecContext = { ...context };
        if (spec.needs) {
          const parentSpec = OBJECT_SPECS.find(
            (s) => s.type === (spec.needs === 'ddl' ? 'ddl' : 'functionGroup'),
          ) as IObjectSpec;
          const parent = probe.name(
            { code: `${spec.code[0]}${parentSpec.code[0]}` },
            'Q',
          );
          const made = await probe.dependency(
            parentSpec,
            parent,
            spec.needs === 'ddl' ? parentSpec.source?.(parent, ctx) : undefined,
          );
          if (!made) {
            row.note = `its ${spec.needs} could not be created and activated`;
            continue;
          }
          ctx.parent = parent;
        }
        const name = probe.name(spec, 'U');
        const config = spec.config(name, ctx);
        probe.remember(spec, name, ctx);
        const pair = (m: string) => knownPair(spec.handler, m) as IAdtHeaders;
        const handle = (client: AdtClient) => spec.handle(client);
        const created = await probe.direct1((client, analyse) =>
          Promise.resolve(
            handle(client).create?.(config, {
              headers: pair('create'),
              analyse,
            }),
          ),
        );
        if (!okOf(created)) {
          row.note = `the create answered ${statusOf(created) ?? created.failure}`;
          continue;
        }
        const read = () =>
          probe.direct1((client, analyse) =>
            Promise.resolve(
              spec.write === 'source'
                ? handle(client).read?.(config, 'inactive', { analyse })
                : handle(client).readMetadata?.(config, { analyse }),
            ),
          );
        const before = await read();
        const content = bodyOf(before);
        if (!okOf(before) || content === undefined) {
          row.note = `the read before answered ${statusOf(before) ?? before.failure}`;
          continue;
        }
        const changed =
          spec.write === 'source'
            ? changedSource(spec.type, spec.source?.(name, ctx) ?? content)
            : changedMetadata(content);
        const locked = await probe.direct1((client, analyse) =>
          Promise.resolve(handle(client).lock?.(config, { analyse })),
        );
        const result = locked.result as
          | { ok?: boolean; getResult?: () => { value: unknown } }
          | undefined;
        const lockHandle =
          result?.ok && result.getResult ? result.getResult().value : undefined;
        if (typeof lockHandle !== 'string' || !lockHandle) {
          row.note = `the lock answered ${statusOf(locked) ?? locked.failure}`;
          continue;
        }
        await withLock(
          lockHandle,
          // Released after an interrupt too: unlocking is cleanup.
          (held) =>
            probe.release(
              `${spec.type} ${name}`,
              (h) => (client, analyse) =>
                Promise.resolve(
                  handle(client).unlock?.(config, h, { analyse }),
                ),
              held,
            ),
          async (held) => {
            const updated = await probe.direct1((client, analyse) =>
              Promise.resolve(
                handle(client)[member]?.(config, {
                  headers: {
                    accept: PROBE_TYPE,
                    contentType: pair(member).contentType,
                  },
                  source: changed,
                  lockHandle: held,
                  analyse,
                }),
              ),
            );
            const status = statusOf(updated);
            if (status !== undefined) row.status = status;
            const request = updated.requests[updated.requests.length - 1];
            if (request)
              rows.push({
                source: 'clients',
                group: spec.handler,
                label: member,
                endpoint: endpointOf(
                  request.method,
                  request.url,
                  request.params,
                  probe.names,
                ),
                requests: [],
                onWire: [],
                named: emptyNamed(),
                ...(status !== undefined ? { status } : {}),
                ...(updated.wire
                  ? { body: String(updated.wire.data ?? '') }
                  : {}),
                ...(updated.failure ? { failure: updated.failure } : {}),
              });
            const sapType = updated.wire
              ? sapErrorIn(String(updated.wire.data ?? ''))?.adtType
              : undefined;
            if (sapType) row.sapType = sapType;
          },
        );
        const after = await read();
        const later = bodyOf(after);
        if (!okOf(after) || later === undefined) {
          row.note = `the read after answered ${statusOf(after) ?? after.failure}`;
          continue;
        }
        row.applied = hashOf(later) !== hashOf(content);
      }
    });
  } catch (thrown) {
    if (!(thrown instanceof Interrupted))
      error = thrown instanceof Error ? thrown.message : String(thrown);
  }
  if (probe.lockFailures.length)
    error ??= `unlock failed: ${probe.lockFailures.join('; ')}`;
  for (const row of rows) {
    const sapType = sapErrorIn(row.body ?? '')?.adtType;
    if (sapType) row.sapType = sapType;
  }
  return { updates, removals, rows, ...(error ? { error } : {}) };
}
