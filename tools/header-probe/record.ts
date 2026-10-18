/**
 * The header probe's pure parts: what one answer records, the rows, the
 * summary and the two report files. Nothing here sends a request.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { sapErrorIn } from '../../src/utils/adtErrors';
import {
  extractSupportedAccept,
  extractSupportedContentType,
} from '../../src/utils/supportedMediaTypes';

/** The media type no ADT resource serves: what the two bad probes send. */
export const PROBE_TYPE = 'application/x-header-probe';

export type ProbeKind = 'known' | 'badAccept' | 'badContentType';

export const PROBE_KINDS: readonly ProbeKind[] = [
  'known',
  'badAccept',
  'badContentType',
];

/** The pair each probe sends, built from the operation's known pair. */
export function probePair(kind: ProbeKind, known: IAdtHeaders): IAdtHeaders {
  if (kind === 'badAccept') return { ...known, accept: PROBE_TYPE };
  if (kind === 'badContentType') return { ...known, contentType: PROBE_TYPE };
  return { ...known };
}

/** What a read of the object said right after a write probe. */
export interface IObjectState {
  status?: number;
  exists: boolean | 'unknown';
  /** `adtcore:version` of the metadata document, when it names one. */
  version?: string;
}

/** The request that went out, as the member issued it. */
export interface ISentRequest {
  method: string;
  /** The URL path with the object's name as `{name}` and no query. */
  path: string;
  /** The query's `_action` (`LOCK`, `UNLOCK`, …), when it has one. */
  action?: string;
}

/**
 * The endpoint a request went to: its method, its path with the object's
 * names as `{name}`, and its `_action`, read from the query or the params.
 */
export function endpointOf(
  method: string,
  url: string,
  params: unknown,
  names: readonly string[],
): ISentRequest {
  const query = url.indexOf('?');
  const fromQuery =
    query === -1
      ? null
      : new URLSearchParams(url.slice(query + 1)).get('_action');
  const fromParams =
    params && typeof params === 'object'
      ? (params as Record<string, unknown>)._action
      : undefined;
  const action =
    fromQuery ?? (typeof fromParams === 'string' ? fromParams : undefined);
  const request: ISentRequest = {
    method: method.toUpperCase(),
    path: normalizePath(url, names),
  };
  if (action) request.action = action;
  return request;
}

/** One endpoint as text: `POST /path?_action=LOCK`. */
export function endpointKey(request: ISentRequest): string {
  return `${request.method} ${request.path}${request.action ? `?_action=${request.action}` : ''}`;
}

export interface IProbeAnswer {
  probe: ProbeKind;
  sent: IAdtHeaders;
  /** `batched`, or `sequential: <reason>`. */
  mode: string;
  /** Every request the member issued (a chain issues several). */
  requests: ISentRequest[];
  status?: number;
  sapType?: string;
  sapMessage?: string;
  /** The answer's own `content-type` header. */
  responseContentType?: string;
  supportedAccept: string[];
  supportedContentType: string[];
  /** The raw `Accepted content types: …` text of the body, when present. */
  acceptedText?: string;
  /** Why there is no answer: nothing came back, or the member threw. */
  failure?: string;
  /** The body of a non-2xx answer, cut at {@link BODY_LIMIT} characters. */
  body?: string;
  /** Read after a write probe. */
  stateAfter?: IObjectState;
}

export interface IOperationRow {
  objectType: string;
  member: string;
  known?: IAdtHeaders;
  /** `skipped: <reason>` rows carry no probes. */
  skipped?: string;
  probes: IProbeAnswer[];
}

export interface IRemoval {
  label: string;
  removed: boolean;
  detail: string;
}

export interface IProbeReport {
  startedAt: string;
  finishedAt?: string;
  mode: 'batched' | 'sequential';
  filters: { only?: string[]; operation?: string };
  rows: IOperationRow[];
  removals: IRemoval[];
  /** What stopped the run, when something did. */
  error?: string;
}

export const BODY_LIMIT = 4000;

const ACCEPTED_CONTENT_TYPES = 'Accepted content types:';
const SAP_PREFIX = 'SAP refused the request: ';

/** The raw `Accepted content types: …` text, up to the end of its element or line. */
export function acceptedContentTypesText(body: string): string | undefined {
  const at = body.indexOf(ACCEPTED_CONTENT_TYPES);
  if (at === -1) return undefined;
  let end = body.length;
  for (const stop of ['<', '"', '\n']) {
    const found = body.indexOf(stop, at);
    if (found !== -1 && found < end) end = found;
  }
  return body.slice(at, end).trim();
}

function headerValue(
  headers: IAdtWireResponse['headers'] | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name)
      return value == null ? undefined : String(value);
  }
  return undefined;
}

/** What one probe records, from the answer it got. */
export function readAnswer(input: {
  probe: ProbeKind;
  sent: IAdtHeaders;
  mode: string;
  requests: ISentRequest[];
  wire?: IAdtWireResponse;
  failure?: string;
}): IProbeAnswer {
  const { wire } = input;
  const answer: IProbeAnswer = {
    probe: input.probe,
    sent: input.sent,
    mode: input.mode,
    requests: input.requests,
    supportedAccept: [],
    supportedContentType: [],
  };
  if (!wire) {
    answer.failure = input.failure ?? 'no answer';
    return answer;
  }
  const body =
    typeof wire.data === 'string'
      ? wire.data
      : wire.data == null
        ? ''
        : JSON.stringify(wire.data);
  answer.status = wire.status;
  answer.responseContentType = headerValue(wire.headers, 'content-type');
  const refusal = sapErrorIn(body);
  if (refusal) {
    answer.sapType = refusal.adtType;
    answer.sapMessage = refusal.message.startsWith(SAP_PREFIX)
      ? refusal.message.slice(SAP_PREFIX.length)
      : refusal.message;
  }
  const asError = { response: wire };
  answer.supportedAccept = extractSupportedAccept(asError);
  answer.supportedContentType = extractSupportedContentType(asError);
  answer.acceptedText = acceptedContentTypesText(body);
  if (wire.status < 200 || wire.status >= 300) {
    answer.body = body.slice(0, BODY_LIMIT);
  }
  if (input.failure) answer.failure = input.failure;
  return answer;
}

/** What a metadata read says about the object. */
export function readState(wire: IAdtWireResponse | undefined): IObjectState {
  if (!wire) return { exists: 'unknown' };
  if (wire.status === 404) return { status: 404, exists: false };
  if (wire.status < 200 || wire.status >= 300)
    return { status: wire.status, exists: 'unknown' };
  const body = typeof wire.data === 'string' ? wire.data : '';
  const marker = 'adtcore:version="';
  const at = body.indexOf(marker);
  const version =
    at === -1
      ? undefined
      : body.slice(at + marker.length, body.indexOf('"', at + marker.length));
  return { status: wire.status, exists: true, version };
}

/**
 * The request's path with every given name replaced by `{name}`, no query.
 *
 * Names are matched case-insensitively and in their URL-encoded form, longest
 * first, as whole path segments or segment parts (`zx%2fy`).
 */
export function normalizePath(url: string, names: readonly string[]): string {
  const query = url.indexOf('?');
  let path = query === -1 ? url : url.slice(0, query);
  const forms = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    forms.add(encodeURIComponent(name.toLowerCase()));
    forms.add(encodeURIComponent(name));
    forms.add(name.toLowerCase());
    forms.add(name);
  }
  const ordered = [...forms].sort((a, b) => b.length - a.length);
  const segments = path.split('/').map((segment) => {
    const lower = segment.toLowerCase();
    for (const form of ordered) {
      if (lower === form.toLowerCase()) return '{name}';
    }
    return segment;
  });
  path = segments.join('/');
  return path;
}

export interface IRefusedPair {
  objectType: string;
  member: string;
  status: number;
  sent: IAdtHeaders;
  named: string[];
  sapMessage?: string;
}

/** Every operation whose known pair SAP refused with 406 or 415. */
export function refusedKnownPairs(
  rows: readonly IOperationRow[],
): IRefusedPair[] {
  const refused: IRefusedPair[] = [];
  for (const row of rows) {
    const known = row.probes.find((probe) => probe.probe === 'known');
    if (!known || (known.status !== 406 && known.status !== 415)) continue;
    refused.push({
      objectType: row.objectType,
      member: row.member,
      status: known.status,
      sent: known.sent,
      named:
        known.status === 406
          ? known.supportedAccept
          : known.supportedContentType,
      sapMessage: known.sapMessage,
    });
  }
  return refused;
}

/** One row's use of a shared endpoint: what it sent and what SAP answered. */
export interface IEndpointUse {
  /** `<object type>.<member>`. */
  user: string;
  known?: IAdtHeaders;
  /** Per probe: status, then the types SAP named. */
  answers: Record<ProbeKind, string>;
}

export interface IPathCollision {
  /** `METHOD path[?_action=…]`. */
  endpoint: string;
  uses: IEndpointUse[];
  /** True when the rows on this endpoint got different answers to the same probe. */
  answersDiffer: boolean;
}

function answerSignature(answer: IProbeAnswer | undefined): string {
  if (!answer) return 'not sent';
  if (answer.status === undefined) return 'no answer';
  const named = [
    answer.supportedAccept.length
      ? `accept: ${answer.supportedAccept.join(', ')}`
      : '',
    answer.supportedContentType.length
      ? `content-type: ${answer.supportedContentType.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('; ');
  return named ? `${answer.status} (${named})` : String(answer.status);
}

/**
 * Every endpoint that two members, or two object types, both hit.
 *
 * One endpoint, one member: each is a possible breach of that rule. Rows on
 * one endpoint should be answered alike, since what an endpoint accepts does
 * not depend on who calls it; `answersDiffer` flags where they were not. Read
 * from the known probe's requests, the ones each member sends as intended.
 */
export function pathCollisions(
  rows: readonly IOperationRow[],
): IPathCollision[] {
  const byEndpoint = new Map<string, Map<string, IEndpointUse>>();
  for (const row of rows) {
    const known = row.probes.find((probe) => probe.probe === 'known');
    if (!known) continue;
    const user = `${row.objectType}.${row.member}`;
    for (const request of known.requests) {
      const key = endpointKey(request);
      const uses = byEndpoint.get(key) ?? new Map<string, IEndpointUse>();
      const of = (kind: ProbeKind) =>
        answerSignature(row.probes.find((probe) => probe.probe === kind));
      uses.set(user, {
        user,
        known: row.known,
        answers: {
          known: of('known'),
          badAccept: of('badAccept'),
          badContentType: of('badContentType'),
        },
      });
      byEndpoint.set(key, uses);
    }
  }
  const collisions: IPathCollision[] = [];
  for (const [endpoint, users] of byEndpoint) {
    if (users.size < 2) continue;
    const uses = [...users.values()].sort((a, b) =>
      a.user.localeCompare(b.user),
    );
    const answersDiffer = PROBE_KINDS.some(
      (kind) => new Set(uses.map((use) => use.answers[kind])).size > 1,
    );
    collisions.push({ endpoint, uses, answersDiffer });
  }
  return collisions.sort((a, b) => a.endpoint.localeCompare(b.endpoint));
}

export interface IModeDifference {
  objectType: string;
  member: string;
  probe: ProbeKind;
  batched: string;
  sequential: string;
}

function outcome(answer: IProbeAnswer | undefined): string {
  if (!answer) return 'absent';
  if (answer.status === undefined) return `no answer (${answer.failure ?? ''})`;
  return [
    String(answer.status),
    answer.sapType ?? '',
    answer.supportedAccept.join(', '),
    answer.supportedContentType.join(', '),
  ].join(' | ');
}

/** Every probe whose status, SAP type or named types differ between a batched and a sequential report. */
export function modeDifferences(
  batched: IProbeReport,
  sequential: IProbeReport,
): IModeDifference[] {
  const differences: IModeDifference[] = [];
  for (const row of batched.rows) {
    const twin = sequential.rows.find(
      (other) =>
        other.objectType === row.objectType && other.member === row.member,
    );
    if (!twin) continue;
    for (const probe of PROBE_KINDS) {
      const a = outcome(row.probes.find((answer) => answer.probe === probe));
      const b = outcome(twin.probes.find((answer) => answer.probe === probe));
      if (a !== b)
        differences.push({
          objectType: row.objectType,
          member: row.member,
          probe,
          batched: a,
          sequential: b,
        });
    }
  }
  return differences;
}

const cell = (value: string | undefined): string =>
  (value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();

function probeCells(answer: IProbeAnswer | undefined): string[] {
  if (!answer) return ['', '', ''];
  const status =
    answer.status === undefined
      ? `no answer: ${answer.failure ?? ''}`
      : String(answer.status);
  const named = [
    ...(answer.supportedAccept.length
      ? [`accept: ${answer.supportedAccept.join(', ')}`]
      : []),
    ...(answer.supportedContentType.length
      ? [`content-type: ${answer.supportedContentType.join(', ')}`]
      : []),
  ].join('; ');
  const message = [answer.sapType, answer.sapMessage]
    .filter(Boolean)
    .join(': ');
  return [cell(status), cell(named), cell(message)];
}

function stateCell(row: IOperationRow): string {
  return row.probes
    .filter((probe) => probe.stateAfter)
    .map((probe) => {
      const state = probe.stateAfter as IObjectState;
      const exists =
        state.exists === 'unknown'
          ? `unknown${state.status ? ` (${state.status})` : ''}`
          : state.exists
            ? `exists${state.version ? ` ${state.version}` : ''}`
            : 'absent';
      return `${probe.probe}: ${exists}`;
    })
    .join('; ');
}

function rowMode(row: IOperationRow): string {
  if (row.skipped) return row.skipped;
  const modes = [...new Set(row.probes.map((probe) => probe.mode))];
  return modes.join('; ');
}

function rowRequest(row: IOperationRow): string {
  const known = row.probes.find((probe) => probe.probe === 'known');
  const requests = known?.requests ?? row.probes[0]?.requests ?? [];
  return requests.map(endpointKey).join('; ');
}

/** The Markdown report: a table per object type, then the summary. */
export function renderMarkdown(report: IProbeReport): string {
  const lines: string[] = [
    '# Header probe report',
    '',
    `Started ${report.startedAt}${report.finishedAt ? `, finished ${report.finishedAt}` : ''}; mode: ${report.mode}.`,
    `Bad probes send \`${PROBE_TYPE}\` as the Accept (bad Accept) or as the Content-Type (bad Content-Type).`,
    '',
  ];
  if (report.error)
    lines.push(`**The run stopped:** ${cell(report.error)}`, '');
  const types = [...new Set(report.rows.map((row) => row.objectType))];
  for (const type of types) {
    lines.push(
      `## ${type}`,
      '',
      '| operation | request | ran | known: status | known: accepted types | known: SAP message | bad Accept: status | bad Accept: accepted types | bad Accept: SAP message | bad Content-Type: status | bad Content-Type: accepted types | bad Content-Type: SAP message | state after the write |',
      '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
    );
    for (const row of report.rows.filter(
      (entry) => entry.objectType === type,
    )) {
      const of = (kind: ProbeKind) =>
        probeCells(row.probes.find((probe) => probe.probe === kind));
      lines.push(
        `| ${cell(row.member)} | ${cell(rowRequest(row))} | ${cell(rowMode(row))} | ${[
          ...of('known'),
          ...of('badAccept'),
          ...of('badContentType'),
        ].join(' | ')} | ${cell(stateCell(row))} |`,
      );
    }
    lines.push('');
  }

  lines.push('## Summary', '', '### Known pairs refused', '');
  const refused = refusedKnownPairs(report.rows);
  if (!refused.length)
    lines.push('None: SAP refused no known pair with 406 or 415.');
  else {
    lines.push(
      '| object type | operation | status | sent Accept | sent Content-Type | the system named | SAP message |',
      '|---|---|---|---|---|---|---|',
    );
    for (const entry of refused)
      lines.push(
        `| ${cell(entry.objectType)} | ${cell(entry.member)} | ${entry.status} | ${cell(entry.sent.accept)} | ${cell(entry.sent.contentType)} | ${cell(entry.named.join(', ') || '(nothing)')} | ${cell(entry.sapMessage)} |`,
      );
  }

  lines.push(
    '',
    '### One endpoint, one member: endpoints several rows share',
    '',
  );
  const collisions = pathCollisions(report.rows);
  if (!collisions.length)
    lines.push('None: no two members or object types hit the same endpoint.');
  for (const entry of collisions) {
    lines.push(
      `#### \`${entry.endpoint}\`${entry.answersDiffer ? ' — **the answers differ between these rows**' : ''}`,
      '',
      '| used by | known Accept | known Content-Type | known | bad Accept | bad Content-Type |',
      '|---|---|---|---|---|---|',
    );
    for (const use of entry.uses)
      lines.push(
        `| ${cell(use.user)} | ${cell(use.known?.accept)} | ${cell(use.known?.contentType)} | ${cell(use.answers.known)} | ${cell(use.answers.badAccept)} | ${cell(use.answers.badContentType)} |`,
      );
    lines.push('');
  }

  const skipped = report.rows.filter((row) => row.skipped);
  if (skipped.length) {
    lines.push('', '### Skipped', '');
    for (const row of skipped)
      lines.push(`- ${row.objectType}.${row.member}: ${cell(row.skipped)}`);
  }

  lines.push('', '### Temporary objects', '');
  if (!report.removals.length) lines.push('The run created nothing.');
  for (const removal of report.removals)
    lines.push(
      `- ${removal.removed ? 'removed' : '**NOT REMOVED**'}: ${cell(removal.label)} — ${cell(removal.detail)}`,
    );
  const left = report.removals.filter((removal) => !removal.removed);
  if (left.length)
    lines.push(
      '',
      `**${left.length} temporary object(s) could not be removed; delete them by hand.**`,
    );
  lines.push('');
  return lines.join('\n');
}

/** The Markdown comparison of a batched and a sequential report. */
export function renderComparison(
  batched: IProbeReport,
  sequential: IProbeReport,
): string {
  const differences = modeDifferences(batched, sequential);
  const lines = [
    '# Header probe: batched against sequential',
    '',
    `Batched run ${batched.startedAt}, sequential run ${sequential.startedAt}.`,
    '',
  ];
  if (!differences.length) {
    lines.push('No probe differs in status, SAP type or named types.', '');
    return lines.join('\n');
  }
  lines.push(
    '| object type | operation | probe | batched | sequential |',
    '|---|---|---|---|---|',
  );
  for (const entry of differences)
    lines.push(
      `| ${cell(entry.objectType)} | ${cell(entry.member)} | ${entry.probe} | ${cell(entry.batched)} | ${cell(entry.sequential)} |`,
    );
  lines.push('');
  return lines.join('\n');
}
