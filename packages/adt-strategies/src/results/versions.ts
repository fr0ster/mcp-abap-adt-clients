import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import { rawOf } from '../result';

/** One entry of an object's version history. */
export interface IObjectVersion {
  versionId: string;
  author?: string;
  updatedAt?: string;
  title?: string;
  /** Opaque and complete — pass it back to `getVersionSource`. */
  contentUri: string;
  transportRequest?: string;
  transportDescription?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
});

const TRANSPORT_REL = 'http://www.sap.com/adt/relations/transport/request';

function transportOf(entry: Record<string, any>): {
  request?: string;
  description?: string;
} {
  const raw = entry['atom:link'] ?? entry.link;
  const links = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const link = links.find(
    (l: Record<string, any>) => l?.['@_rel'] === TRANSPORT_REL,
  );
  if (!link) return {};
  return {
    request: String(link['@_adtcore:name'] ?? '') || undefined,
    description: String(link['@_title'] ?? '') || undefined,
  };
}

/**
 * An object's version history, read out of the Atom feed
 * `<sourceUri>/versions` answers.
 *
 * Moved from adt-clients, where `getVersions` applied it for every caller and
 * threw on a 404 or 406 — a system without the resource — as if the library had
 * failed. The client answers the feed as it arrived now; a caller who wants the
 * entries passes this, and one who wants a missing resource named passes
 * `analyseUnsupportedStatus([404, 406], 'version history')`.
 */
export const objectVersions: IResultStrategy<IObjectVersion[]> = (answer) => {
  const text = rawOf(answer);
  if (!text.trim()) return [];
  const root = parser.parse(text) as Record<string, any>;
  const feed = root['atom:feed'] ?? root.feed;
  if (!feed) return [];
  const title = feed['atom:title'] ?? feed.title;
  const raw = feed['atom:entry'] ?? feed.entry;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return entries.map((e: Record<string, any>) => {
    const content = e['atom:content'] ?? e.content ?? {};
    const author = e['atom:author'] ?? e.author;
    const transport = transportOf(e);
    return {
      versionId: String(e['atom:id'] ?? e.id ?? ''),
      author: author
        ? String(author['atom:name'] ?? author.name ?? '') || undefined
        : undefined,
      updatedAt:
        (e['atom:updated'] ?? e.updated)
          ? String(e['atom:updated'] ?? e.updated)
          : undefined,
      title: title ? String(title) : undefined,
      contentUri: String(content['@_src'] ?? ''),
      transportRequest: transport.request,
      transportDescription: transport.description,
    };
  });
};
