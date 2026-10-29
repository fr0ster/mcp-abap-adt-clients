import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import { field } from '../parsed';
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

function transportOf(entry: unknown): {
  request?: string;
  description?: string;
} {
  const raw = field(entry, 'atom:link') ?? field(entry, 'link');
  const links = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const link = links.find((l: unknown) => field(l, '@_rel') === TRANSPORT_REL);
  if (!link) return {};
  return {
    request: String(field(link, '@_adtcore:name') ?? '') || undefined,
    description: String(field(link, '@_title') ?? '') || undefined,
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
  const root: unknown = parser.parse(text);
  const feed = field(root, 'atom:feed') ?? field(root, 'feed');
  if (!feed) return [];
  const title = field(feed, 'atom:title') ?? field(feed, 'title');
  const raw = field(feed, 'atom:entry') ?? field(feed, 'entry');
  const entries: unknown[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return entries.map((e) => {
    const content = field(e, 'atom:content') ?? field(e, 'content') ?? {};
    const author = field(e, 'atom:author') ?? field(e, 'author');
    const updated = field(e, 'atom:updated') ?? field(e, 'updated');
    const transport = transportOf(e);
    return {
      versionId: String(field(e, 'atom:id') ?? field(e, 'id') ?? ''),
      author: author
        ? String(field(author, 'atom:name') ?? field(author, 'name') ?? '') ||
          undefined
        : undefined,
      updatedAt: updated ? String(updated) : undefined,
      title: title ? String(title) : undefined,
      contentUri: String(field(content, '@_src') ?? ''),
      transportRequest: transport.request,
      transportDescription: transport.description,
    };
  });
};
