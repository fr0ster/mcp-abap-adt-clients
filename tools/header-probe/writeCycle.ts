/**
 * Phase 2's writes: the header probe's temporary-object cycle, run only for
 * the object types whose write members phase 1 left unknown, with the bogus
 * Content-Type before the bogus Accept. Its ledger holds every object before
 * its create is sent; its locks are released in a `finally`; the state is
 * read after every write probe.
 */

import type { ICorpusRow, IEvidence, IHeaderVerdict } from './corpus';
import { judge } from './corpus';
import type { IWriteCycleInput, IWriteCycleResult } from './corpusRun';
import { Interrupted, Ledger, withCleanup } from './ledger';
import { LOCAL_INCLUDES, OBJECT_SPECS } from './objects';
import { Probe, randomRun } from './probe';
import {
  endpointKey,
  type IOperationRow,
  type IProbeAnswer,
  type IRemoval,
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

/** The cycle, on the types the unknown writes belong to. */
export async function runWriteCycle(
  input: IWriteCycleInput & { packageName: string; transportRequest: string },
): Promise<IWriteCycleResult> {
  const wanted = new Set<string>();
  const types = new Set<string>();
  for (const key of input.unknown) {
    const who = key.slice(0, key.indexOf(' — '));
    if (who.startsWith('legacy ')) continue;
    const handler = who.slice(0, who.lastIndexOf('.'));
    const type = typeOfHandler(handler);
    if (!type) continue;
    wanted.add(who);
    types.add(type);
  }
  const removals: IRemoval[] = [];
  if (!types.size) return { evidence: [], removals };
  const ledger = new Ledger((removal) => removals.push(removal));
  const probe = new Probe(
    input.connection,
    input.clientOptions,
    { only: [...types], sequential: false, contentTypeFirst: true },
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
  return {
    evidence: evidenceOfRows(probe.rows, wanted),
    removals,
    ...(error ? { error } : {}),
  };
}
