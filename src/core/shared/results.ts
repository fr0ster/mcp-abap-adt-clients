/**
 * The shapes this library's readings build, and the readings that build them.
 *
 * They lived in `@mcp-abap-adt/interfaces` until 31.0.0. Decision 24 took them
 * out: a contract carries what is needed to **use** it or **replace** it, and
 * what a reading makes of a document is neither — a caller reads it off whatever
 * their implementation answers, and a replacement returns its own.
 *
 * So a shape lives here, beside the strategy that produces it. That pairing is
 * the point: a type nobody can produce from an answer is a type this package has
 * no business declaring, and keeping them together is what makes that visible.
 */
import type {
  IAdtWireResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';

/**
 * One entry of an object's version history.
 *
 * Measured from the Atom feed `<sourceUri>/versions` answers, not designed:
 * `versionId` and `contentUri` are the two a caller cannot do without — the
 * first names the version, the second is the opaque URI that fetches its source
 * — and the rest are present in the feeds that carry them.
 */
export interface ObjectVersion {
  /** Version number, e.g. `'00000'`. */
  versionId: string;
  /** The user who created the version (`atom:author/name`), if present. */
  author?: string;
  /** ISO timestamp of the version (`atom:updated`), if present. */
  updatedAt?: string;
  /** Feed title, e.g. `'Version List of ZCL_X (CLAS)'`, if present. */
  title?: string;
  /** Opaque, complete URI to fetch this version's source (`atom:content@src`). */
  contentUri: string;
  /** Transport request this version was recorded under, if any. */
  transportRequest?: string;
  /** Short text of that transport request, if any. */
  transportDescription?: string;
}

const versionParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/**
 * The version feed, read as entries.
 *
 * An entry without a `contentUri` is dropped rather than half-built: the URI is
 * the only way to fetch that version, so an entry without one is a row a caller
 * can do nothing with.
 */
export const versionList: IResultStrategy<ObjectVersion[]> = (
  answer: IAdtWireResponse,
) => {
  const feed = versionParser.parse(String(answer.data ?? ''))?.feed;
  return asArray(feed?.entry as Record<string, unknown>[] | undefined)
    .map((entry): ObjectVersion | undefined => {
      const content = entry?.content as Record<string, unknown> | undefined;
      const contentUri = content?.['@_src'] as string | undefined;
      if (!contentUri) return undefined;
      const author = entry?.author as Record<string, unknown> | undefined;
      return {
        versionId: String(entry?.title ?? entry?.id ?? ''),
        author: author?.name as string | undefined,
        updatedAt: entry?.updated as string | undefined,
        title: entry?.title as string | undefined,
        contentUri,
      };
    })
    .filter((entry): entry is ObjectVersion => entry !== undefined);
};
