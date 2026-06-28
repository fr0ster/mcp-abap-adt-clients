import {
  AdtObjectErrorCodes,
  AdtOperationError,
  type IObjectVersion,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
});

/** Parse an ADT versions Atom feed into a list of versions. Pure — no endpoints. */
export function parseVersionsFeed(xml: string): IObjectVersion[] {
  const root = parser.parse(xml) as Record<string, any>;
  const feed = root['atom:feed'] ?? root.feed;
  if (!feed) return [];
  const title = feed['atom:title'] ?? feed.title;
  const rawEntries = feed['atom:entry'] ?? feed.entry;
  const entries = Array.isArray(rawEntries)
    ? rawEntries
    : rawEntries
      ? [rawEntries]
      : [];
  return entries.map((e: Record<string, any>) => {
    const content = e['atom:content'] ?? e.content ?? {};
    const author = e['atom:author'] ?? e.author;
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
    };
  });
}

/** Throw a typed "no version history" error. Used by non-source types and by
 *  source types when SAP reports the versions resource is absent (404/406). */
export function throwUnsupportedVersions(detail?: string): never {
  const e = new AdtOperationError(
    `Version history is not available${detail ? ` for ${detail}` : ''}`,
  );
  e.code = AdtObjectErrorCodes.UNSUPPORTED_OPERATION;
  throw e;
}

/** Translate ANY version-request failure into an interface-level error so no
 *  raw IAdtResponse/axios object ever leaks outward. 404/406 → unsupported;
 *  everything else → AdtOperationError carrying status + originalError.
 *  Call this from the catch of every version list/content GET. */
export function throwVersionsError(error: unknown, detail: string): never {
  const status = (error as any)?.response?.status ?? (error as any)?.status;
  if (status === 404 || status === 406) {
    throwUnsupportedVersions(detail);
  }
  const e = new AdtOperationError(
    `Failed to read version history for ${detail}`,
  );
  if (typeof status === 'number') e.status = status;
  e.originalError = error;
  throw e;
}
