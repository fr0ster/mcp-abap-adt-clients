/**
 * The one result strategy here, and the reason it is the only one.
 *
 * Shaping a result is the consumer's decision — which fields they want, what
 * they intend to do with them — and there is no defensible default for it. What
 * there *is* a defensible default for is the absence of shaping: hand the answer
 * back as it arrived.
 *
 * That covers more members than it looks. Source is obvious: the text is the
 * answer, and parsing it would be a lie. Metadata is the one worth saying out
 * loud — it is XML, and a caller who passes it on as a string has not lost
 * anything, because nothing here knows which of its elements they wanted.
 *
 * Everything else this package collects is on the error axis.
 */

import type {
  IAdtWireResponse,
  IResultStrategy,
} from '@mcp-abap-adt/interfaces';

/**
 * `answer.data` as text, without pretending an object was ever a string.
 *
 * A transport may hand back a parsed object where the server sent a document —
 * so this states the conversion rather than asserting the type.
 */
export function rawOf(answer: IAdtWireResponse): string {
  const body = (answer as { data?: unknown }).data;
  if (typeof body === 'string') return body;
  if (body === undefined || body === null) return '';
  if (typeof body === 'object') {
    try {
      return JSON.stringify(body);
    } catch {
      return String(body);
    }
  }
  return String(body);
}

/**
 * The answer, unchanged — XML for a metadata read, ABAP text for a source read,
 * an empty string where the server sent nothing.
 *
 * `@mcp-abap-adt/adt-clients` ships the same thing as `rawDocument` and uses it
 * as the default for almost every member. It is here so a consumer who wants
 * the defaults needs one import rather than two.
 */
export const asItCame: IResultStrategy<string> = (answer) => rawOf(answer);
