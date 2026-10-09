/**
 * Reading the ATC answers a check run is made of.
 *
 * Moved from adt-clients, where `AdtAtc` applied these to every answer and threw
 * where a value was missing — a customizing without `systemCheckVariant`, a run
 * accepted without `Location`, a waiting run without `FINDING_STATS`, a run
 * resource without `runs:status`. Each of those is SAP's answer lacking
 * something, so each reads here as `''` (or an absent field) instead, and the
 * verdict is the caller's `analyse`, which sees the same answer.
 *
 * **An empty value is not a default.** `findingStats: ''` is not `"0,0,0"`: a
 * caller who counts findings from it reads nothing, not a confident zero that
 * looks like a clean check.
 *
 * **Structurally, not by pattern.** These are XML documents, and two things
 * about an XML document carry no meaning: the order of attributes on an
 * element, and which prefix a namespace was bound to. `removeNSPrefix` drops the
 * prefixes so `runs:status` and `r:status` are the same attribute;
 * `parseTagValue: false` keeps every text value a string, so a worklist id of
 * `00000000000000000000000000000000` does not arrive as a number.
 *
 * The shapes come from `docs/evidence/2026-08-16-atc-trial-probe.md` in
 * adt-clients.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser } from 'fast-xml-parser';
import { rawOf } from '../result';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
});

type Node = Record<string, unknown>;

function parseXml(body: unknown): Node | null {
  if (typeof body !== 'string' || body.trim() === '') return null;
  try {
    return parser.parse(body) as Node;
  } catch {
    // A body that is not XML is a body that carries none of what is looked for
    // here, and reads as such — the caller's analyse sees the same answer.
    return null;
  }
}

/** Elements that appear once are objects and many times are arrays. */
function asArray(value: unknown): Node[] {
  if (value === undefined || value === null) return [];
  return (Array.isArray(value) ? value : [value]).filter(
    (v): v is Node => typeof v === 'object' && v !== null,
  );
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/** The last path segment of a URI, ignoring trailing slashes. */
function lastSegment(uri: string): string | undefined {
  return uri.replace(/\/+$/, '').split('/').pop() || undefined;
}

/** What the run resource says about a run in progress or done. */
export interface IAtcRunStatus {
  /**
   * `runs:status` verbatim, `''` when the resource carried none.
   *
   * A string and not a union: only `"finished"` has been observed, and
   * enumerating the states a server may report, from one state, is how a caller
   * ends up matching against names nothing ever sends.
   */
  status: string;

  /**
   * True when `status` is exactly `finished`, case-normalised.
   *
   * **Completion, not success.** It says the run reached an end, not that the
   * end was a good one: a run can finish having checked nothing, with the
   * reason recorded in the worklist, the run result or one of the logs rather
   * than here.
   *
   * **There is deliberately no `isTerminal` and no `isFailed`.** No failed or
   * cancelled run has been observed, so any state named for one would be
   * invented.
   */
  isFinished: boolean;

  /** The worklist this run writes into, where the answer carries it. */
  worklistId?: string;

  /** From the `displayid` link — a third id, and the one `IAtcLog` reads by. */
  resultId?: string;
}

/**
 * A run started with `wait: false` — 201, empty body, the run id in `Location`.
 *
 * The worklist id is not here: the answer does not carry it, and the caller
 * already has it — it is the id they started the run against.
 */
export interface IAtcStartedRun {
  waited: false;
  /**
   * The run's own id, distinct from the worklist id; `''` when the answer
   * carried no `Location`. Poll `getRunStatus(runId)` until it reports
   * finished, then read `getFindings(worklistId)`.
   */
  runId: string;
}

/** A run started with `wait: true` — 200, `<atcworklist:worklistRun>`. */
export interface IAtcWaitingRun {
  waited: true;
  /** The worklist id the server echoed, if it echoed one. */
  worklistId?: string;
  /**
   * `FINDING_STATS` as the server sent it — a comma-separated triple, for
   * example `"0,0,1"`, read as `(priority 1, priority 2, priority 3)` from the
   * two orderings measured. `''` when the run reported none — never `"0,0,0"`,
   * which would be a confident zero indistinguishable from a clean check.
   */
  findingStats: string;
}

function headerOf(answer: IAdtWireResponse, name: string): string | undefined {
  const headers = answer.headers as Record<string, unknown> | undefined;
  if (!headers) return undefined;
  const key = Object.keys(headers).find(
    (k) => k.toLowerCase() === name.toLowerCase(),
  );
  const value = key ? headers[key] : undefined;
  return typeof value === 'string' ? value : undefined;
}

/**
 * `systemCheckVariant` out of `/atc/customizing`, or `''`.
 *
 * It is one of several `<property>` elements and not the first, so it is found
 * by its `name` rather than by position.
 */
export const atcSystemCheckVariant: IResultStrategy<string> = (answer) => {
  const root = parseXml(answer.data)?.customizing as Node | undefined;
  const properties = (root?.properties as Node | undefined)?.property;
  const match = asArray(properties).find(
    (p) => text(p['@_name']) === 'systemCheckVariant',
  );
  return text(match?.['@_value']) ?? '';
};

/**
 * The id `/atc/worklists` answered with — a bare id in a `text/plain` body,
 * trimmed. `''` when the body was empty.
 */
export const atcWorklistId: IResultStrategy<string> = (answer) =>
  rawOf(answer).trim();

/** The run id out of a `clientWait=false` run's `Location`. */
export const atcStartedRun: IResultStrategy<IAtcStartedRun> = (answer) => {
  const location =
    headerOf(answer, 'location') ?? headerOf(answer, 'content-location') ?? '';
  return { waited: false, runId: lastSegment(location) ?? '' };
};

/**
 * The `<worklistRun>` a `clientWait=true` run answers with.
 *
 * `FINDING_STATS` is one `<info>` among possibly several, and the triple is a
 * sibling of the type that names it — so the pair is found together, not by
 * reaching for the first description in the document.
 */
export const atcWaitingRun: IResultStrategy<IAtcWaitingRun> = (answer) => {
  const run = parseXml(answer.data)?.worklistRun as Node | undefined;
  const infos = asArray((run?.infos as Node | undefined)?.info);
  const stats = infos.find((i) => text(i.type) === 'FINDING_STATS');
  return {
    waited: true,
    worklistId: text(run?.worklistId),
    findingStats: text(stats?.description) ?? '',
  };
};

/**
 * The run resource: its status, and the ids its result links point at.
 *
 * A run still going carries no `<result>` at all, so both ids are optional —
 * this is the answer that gets polled, and it will be read on states nobody has
 * captured.
 */
export const atcRunStatus: IResultStrategy<IAtcRunStatus> = (answer) => {
  const run = parseXml(answer.data)?.run as Node | undefined;
  const links = asArray((run?.result as Node | undefined)?.link);
  // `rel` is a full URL whose last segment names the relation. Matched on that
  // segment rather than on the whole URL: the relation is what is meant.
  const idOf = (relation: string) => {
    const link = links.find(
      (l) =>
        lastSegment(text(l['@_rel']) ?? '')?.toLowerCase() ===
        relation.toLowerCase(),
    );
    const href = text(link?.['@_href']);
    return href ? lastSegment(href) : undefined;
  };
  const status = text(run?.['@_status']) ?? '';
  return {
    status,
    // Exact and case-normalised. A substring test would accept `unfinished`
    // and `not_finished`, opening the worklist on a run that had not run.
    isFinished: status.trim().toLowerCase() === 'finished',
    worklistId: idOf('worklistid'),
    resultId: idOf('displayid'),
  };
};
