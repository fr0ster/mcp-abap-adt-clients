/**
 * The refusal shapes, one per recorded answer.
 *
 * Each of these reads **one** document shape, and each is backed by a file in
 * `corpus/adt/`. They are small on purpose: a refusal is recognised by the
 * shape ADT chose for it, and ADT chose several, so one rule reading all of
 * them would be a rule about nothing.
 *
 * None of them looks at the HTTP status. Ten recorded refusals arrive inside a
 * `2xx`, and the same question — is this name taken? — answers `400` for a
 * class and `200` for a DDL source. Status is a property of the transport;
 * these read what the server said.
 */

import type { IAdtError, IAdtWireResponse } from '@mcp-abap-adt/interfaces';

/** The body, however it arrived. */
export const bodyOf = (answer?: IAdtWireResponse): string =>
  typeof answer?.data === 'string'
    ? answer.data
    : answer?.data === undefined || answer?.data === null
      ? ''
      : JSON.stringify(answer.data);

const refusal = (message: string): IAdtError => ({
  origin: 'refusal',
  message,
});

/**
 * An activation that did not happen.
 *
 * `/sap/bc/adt/activation` answers `200` with a checklist either way. The
 * verdict is a `<msg type="E">`; `activationExecuted="false"` is **not** one —
 * it means no work was done, which is also what an already-active object
 * reports. Corpus: `refusal-activation-fails` against `activation-success-verdict`.
 */
export const activationRefusal = (
  answer?: IAdtWireResponse,
): IAdtError | undefined => {
  const body = bodyOf(answer);
  if (!/<\w*:?msg\b[^>]*\btype="E"/.test(body)) return undefined;
  return refusal(body);
};

/**
 * A check that did not run, or that found an error.
 *
 * Two things, because the endpoint answers `200` for both and they are not the
 * same event. `chkrun:status="notProcessed"` means the object was never
 * checked — corpus: `refusal-check-nonexistent-object`, whose body carries no
 * messages at all and is otherwise indistinguishable from a clean check.
 * A `chkrun:checkMessage` of type `E` means it ran and found something —
 * corpus: `refusal-syntax-check`.
 */
export const checkRunRefusal = (
  answer?: IAdtWireResponse,
): IAdtError | undefined => {
  const body = bodyOf(answer);
  if (/chkrun:status="notProcessed"/.test(body)) return refusal(body);
  if (/<chkrun:checkMessage\b[^>]*\btype="E"/.test(body)) return refusal(body);
  return undefined;
};

/**
 * A deletion the server declined.
 *
 * `200` with `del:isDeleted="false"` and a `del:message type="E"` naming the
 * reason. Corpus: `refusal-delete-refused` against `delete-success`.
 */
export const deletionRefusal = (
  answer?: IAdtWireResponse,
): IAdtError | undefined => {
  const body = bodyOf(answer);
  return /del:isDeleted="false"/.test(body) ? refusal(body) : undefined;
};

/**
 * A deletion check that says no.
 *
 * `200` with `del:isDeletable="false"`. Separate from the one above because it
 * is a separate endpoint and a separate question: this one is asked *before*
 * deleting. Corpus: `refusal-deletion-check-refuses` against
 * `deletion-check-allows`.
 */
export const deletionCheckRefusal = (
  answer?: IAdtWireResponse,
): IAdtError | undefined => {
  const body = bodyOf(answer);
  return /del:isDeletable="false"/.test(body) ? refusal(body) : undefined;
};

/**
 * A validation that says the name is taken — in the shape half the types use.
 *
 * `<asx:abap>` with `<SEVERITY>ERROR</SEVERITY>`, delivered inside a `200`.
 * Corpus: `refusal-validation-name-taken-ddl` and
 * `refusal-validation-name-taken-functiongroup`, against
 * `validation-name-free-*`, which carry the same envelope with no `SEVERITY`.
 *
 * The other half — class, domain, table — answers `400` with an
 * `<exc:exception>`; see {@link exceptionRefusal}.
 */
export const validationRefusal = (
  answer?: IAdtWireResponse,
): IAdtError | undefined => {
  const body = bodyOf(answer);
  return /<SEVERITY>\s*ERROR\s*<\/SEVERITY>/.test(body)
    ? refusal(body)
    : undefined;
};

/**
 * An ADT exception document, wherever it arrives.
 *
 * The shape SAP uses for a refusal it considers an error: `<exc:exception>`
 * with a `type` id and a message. Recorded on `400`, `403`, `404` and `423`,
 * and it can also arrive inside a `2xx`.
 *
 * **This one is last in the composed strategy on purpose.** A transport
 * failure already carries the response, so the library's own verdict is
 * usually the better message; this exists for the case where the document
 * arrives in a success.
 */
export const exceptionRefusal = (
  answer?: IAdtWireResponse,
): IAdtError | undefined => {
  const body = bodyOf(answer);
  return /<\w*:?exception\b/.test(body) ? refusal(body) : undefined;
};
