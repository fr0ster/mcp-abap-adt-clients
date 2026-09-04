/**
 * The verdict ADT returns from `POST /sap/bc/adt/deletion/check`.
 *
 * Twenty-seven modules called that endpoint and threw the answer away, then
 * sent the DELETE regardless. The result was the worst of the three possible
 * behaviours: the object survived, the call reported `errors: []`, and the
 * caller was told the deletion had happened. Chasing an append structure that
 * "would not delete" cost most of a session before the cause turned out to be
 * a verdict nobody read.
 *
 * The response carries more than a yes/no — it says how many references stand
 * in the way, which is what a caller needs to act on:
 *
 * ```xml
 * <del:object del:isDeletable="true"
 *   del:externalStrongReferences="0" del:externalWeakReferences="0"
 *   adtcore:name="ZAC_SVRD_PROBE" adtcore:type="SRVD/SRV"/>
 *   <del:message del:priority="0" del:type="S"><del:text/></del:message>
 * ```
 */

import type {
  AdtNoFailure,
  IAdtError,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ADT_NO_FAILURE } from '@mcp-abap-adt/interfaces';

export interface IDeletionVerdict {
  /** Object the verdict is about, as ADT names it. */
  objectName: string;
  /** SAP's answer to "may this be deleted". */
  isDeletable: boolean;
  /** References that block deletion outright. */
  externalStrongReferences: number;
  /** References that do not block, but which a caller may want to know about. */
  externalWeakReferences: number;
  /** SAP's own wording, where it gave any. */
  message?: string;
  /**
   * Message severity as ADT states it:
   *
   * - `S` — success, nothing in the way.
   * - `W` — a warning. **Not** a refusal; the deletion may proceed.
   * - `E` — an error. The system will not delete the object.
   *
   * Treating `W` as a refusal would be this package deciding something SAP did
   * not, which is not ours to do.
   */
  messageType?: string;
}

/** Raised when ADT answers that an object may not be deleted. */
export class DeletionNotPermittedError extends Error {
  readonly verdict: IDeletionVerdict;
  readonly objectName: string;

  constructor(objectName: string, verdict: IDeletionVerdict) {
    const detail = verdict.message?.trim()
      ? verdict.message.trim()
      : `${verdict.externalStrongReferences} strong and ${verdict.externalWeakReferences} weak external references`;
    super(`ADT refuses to delete ${objectName}: ${detail}`);
    this.name = 'DeletionNotPermittedError';
    this.objectName = objectName;
    this.verdict = verdict;
  }
}

/**
 * Read the verdict out of a deletion-check response.
 *
 * Attribute names are matched with and without the `del:` prefix: the payload
 * is namespaced, but not every parser configuration keeps the prefix, and one
 * module in this package was already reading both spellings.
 */
export function parseDeletionCheck(responseData: unknown): IDeletionVerdict {
  const xml = typeof responseData === 'string' ? responseData : '';
  const attr = (name: string): string | undefined =>
    new RegExp(`(?:del:)?${name}="([^"]*)"`).exec(xml)?.[1];

  const number = (name: string): number => {
    const raw = attr(name);
    const parsed = raw === undefined ? Number.NaN : Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const text = /<del:text>([\s\S]*?)<\/del:text>/.exec(xml)?.[1];

  return {
    // Taken from the response rather than passed in: the payload already
    // names the object, and threading a label through two dozen call sites
    // would be inventing work for something the server states.
    objectName: /adtcore:name="([^"]*)"/.exec(xml)?.[1] ?? '(unnamed object)',
    // Absent means "not stated", and a deletion the server never approved is
    // not one to assume: default to refusing rather than to proceeding.
    isDeletable: attr('isDeletable') === 'true',
    externalStrongReferences: number('externalStrongReferences'),
    externalWeakReferences: number('externalWeakReferences'),
    message: text?.trim() || undefined,
    messageType: /<del:message[^>]*(?:del:)?type="([^"]*)"/.exec(xml)?.[1],
  };
}

/**
 * Throw unless ADT approved the deletion.
 *
 * Deliberately a hard failure rather than a returned flag: a caller that asked
 * for a delete and got a resolved promise is entitled to believe the object is
 * gone.
 *
 * Refusal is `isDeletable="false"`, or a message of type `E`. A `W` is a
 * warning and passes — it is reported through the returned verdict so a caller
 * can act on it, but blocking on one would be inventing a prohibition the
 * server did not state.
 */
export function assertDeletable(responseData: unknown): IDeletionVerdict {
  const verdict = parseDeletionCheck(responseData);
  const refused =
    !verdict.isDeletable || verdict.messageType?.toUpperCase() === 'E';
  if (refused) {
    throw new DeletionNotPermittedError(verdict.objectName, verdict);
  }
  return verdict;
}

/**
 * ADT's own deletion verdict, as a failure rather than an exception.
 *
 * The shipped `analyse` for the deletion-check step of a delete chain. The
 * refusal is the server's — `del:isDeletable="false"`, or a message of type
 * `E`, both of which arrive inside a 200 — so reading it is not this library
 * judging a document, it is this library not throwing the judgement away.
 *
 * {@link assertDeletable} still throws, for the call sites that are not chains.
 * This one returns, because a chain's failures are answered, and a consumer who
 * wants a different reading passes their own `analyse` instead.
 */
export const deletionRefusal = (
  verdict: IAdtError | AdtNoFailure,
  answer?: IAdtWireResponse,
): IAdtError | AdtNoFailure => {
  if (verdict !== ADT_NO_FAILURE) return verdict;
  const read = parseDeletionCheck(answer?.data);
  const refused = !read.isDeletable || read.messageType?.toUpperCase() === 'E';
  if (!refused) return ADT_NO_FAILURE;
  return {
    origin: 'refusal',
    message: new DeletionNotPermittedError(read.objectName, read).message,
    response: answer,
  };
};
