/**
 * Reading the four ATC responses this client depends on.
 *
 * **Structurally, not by pattern.** These are XML documents, and two things
 * about an XML document carry no meaning: the order of attributes on an
 * element, and which prefix a namespace was bound to. A reader that depends on
 * either is reading a formatting accident. `<property value="X"
 * name="systemCheckVariant"/>` is the same element as the one the trial sent
 * with the attributes the other way round, and a server free to emit it would
 * have been told this system has no check variant.
 *
 * `removeNSPrefix` drops the prefixes so `runs:status` and `r:status` are the
 * same attribute; `parseTagValue: false` keeps every text value a string, so a
 * worklist id of `00000000000000000000000000000000` does not arrive as a
 * number.
 *
 * The shapes come from `docs/evidence/2026-08-16-atc-trial-probe.md`.
 */

import { XMLParser } from 'fast-xml-parser';

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
    // here. Each caller already fails naming the value it could not find, and
    // that message is more useful than a parser's.
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

/**
 * `systemCheckVariant` out of an ATC customizing response, or null.
 *
 * It is one of several `<property>` elements and not the first, so it is found
 * by its `name` rather than by position.
 */
export function parseSystemCheckVariant(body: unknown): string | null {
  const root = parseXml(body)?.customizing as Node | undefined;
  const properties = (root?.properties as Node | undefined)?.property;
  const match = asArray(properties).find(
    (p) => text(p['@_name']) === 'systemCheckVariant',
  );
  return text(match?.['@_value']) ?? null;
}

export interface IParsedRunStatus {
  /** `runs:status`, whatever prefix it arrived under. */
  status?: string;
  /** From the `worklistid` atom link, when the run carries a result. */
  worklistId?: string;
  /** From the `displayid` atom link. */
  resultId?: string;
}

/**
 * The run resource: its status, and the ids its result links point at.
 *
 * A run still going carries no `<result>` at all, so both ids are optional —
 * this is the method that gets polled, and it will be called on states nobody
 * has captured.
 */
export function parseRunStatus(body: unknown): IParsedRunStatus {
  const run = parseXml(body)?.run as Node | undefined;
  if (!run) return {};

  const links = asArray((run.result as Node | undefined)?.link);
  // `rel` is a full URL whose last segment names the relation. Matched on that
  // segment rather than on the whole URL: the relation is what is meant, and
  // the host in front of it is not this client's business.
  const idOf = (relation: string) => {
    const link = links.find(
      (l) =>
        lastSegment(text(l['@_rel']) ?? '')?.toLowerCase() ===
        relation.toLowerCase(),
    );
    const href = text(link?.['@_href']);
    return href ? lastSegment(href) : undefined;
  };

  return {
    status: text(run['@_status']),
    worklistId: idOf('worklistid'),
    resultId: idOf('displayid'),
  };
}

export interface IParsedWaitingRun {
  /** The worklist id the server echoed, if it echoed one. */
  worklistId?: string;
  /** The `FINDING_STATS` triple verbatim, if the run reported one. */
  findingStats?: string;
}

/**
 * The `<worklistRun>` a `clientWait=true` run answers with.
 *
 * `FINDING_STATS` is one `<info>` among possibly several, and the triple is a
 * sibling of the type that names it — so the pair is found together, not by
 * reaching for the first description in the document.
 */
export function parseWaitingRun(body: unknown): IParsedWaitingRun {
  const run = parseXml(body)?.worklistRun as Node | undefined;
  if (!run) return {};

  const infos = asArray((run.infos as Node | undefined)?.info);
  const stats = infos.find((i) => text(i.type) === 'FINDING_STATS');

  return {
    worklistId: text(run.worklistId),
    findingStats: text(stats?.description),
  };
}
