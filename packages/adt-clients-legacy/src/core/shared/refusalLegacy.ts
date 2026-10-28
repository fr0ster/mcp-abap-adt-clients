/**
 * The refusal a legacy handler answers for an operation 7.40 SP04 does
 * not serve (spec §2.1): answered through `failed()`, never thrown, with
 * `origin: 'refusal'` and `AdtObjectErrorCodes.UNSUPPORTED_OPERATION`, and a
 * message naming the operation, the endpoint 7.40 lacks and — where there is
 * one — what to use instead. No request is sent, so `options.analyse` has
 * nothing to read.
 */

import { failed } from '@mcp-abap-adt/adt-clients';
import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';

/** `operation` refused: 7.40 SP04 has no `endpoint`; `instead`, if any. */
export function legacyRefusal<T, E extends IAdtError = IAdtError>(
  operation: string,
  endpoint: string,
  instead?: string,
): IAdtResponse<T, E> {
  const message = `${operation}: a legacy system (7.40 SP04) has no ${endpoint}.`;
  // The library's own verdict, so `E` is its default `IAdtError` here — the
  // same cast `answering` makes when no strategy supplied one.
  return failed<T, E>({
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message: instead ? `${message} ${instead}` : message,
  } as E);
}

/**
 * `operation` refused because a run measured that 7.40 SP04 does not serve
 * it: `measured` states what the run answered. Same shape as
 * {@link legacyRefusal}; no request is sent.
 */
export function legacyMeasuredRefusal<T, E extends IAdtError = IAdtError>(
  operation: string,
  measured: string,
): IAdtResponse<T, E> {
  // The library's own verdict, as in legacyRefusal.
  return failed<T, E>({
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message: `${operation}: refused, measured on 7.40 SP04: ${measured}`,
  } as E);
}

/**
 * `readTransport` of a legacy handler: measured on 7.40 SP04, the object's
 * `/transport` resource answers `404` for every type (record
 * B4-cycles-20261026-2019).
 */
export function noTransportResource<T, E extends IAdtError = IAdtError>(
  resource: string,
): IAdtResponse<T, E> {
  return legacyMeasuredRefusal<T, E>(
    'readTransport',
    `GET ${resource}/transport answers 404.`,
  );
}

/**
 * `operation` refused until measured: 7.40 SP04's discovery does not advertise
 * `endpoint`, and no run on it has measured the endpoint. The same shape as
 * {@link legacyRefusal}; the words claim only what discovery shows.
 */
export function legacyUnmeasuredRefusal<T, E extends IAdtError = IAdtError>(
  operation: string,
  endpoint: string,
): IAdtResponse<T, E> {
  // The library's own verdict, as in legacyRefusal.
  return failed<T, E>({
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message:
      `${operation}: a legacy system (7.40 SP04) does not advertise ${endpoint} ` +
      'in its discovery, and it is not measured there, so it is refused until a run measures it.',
  } as E);
}

/**
 * `operation` refused until measured: 7.40 SP04's type table lists no
 * `operation` for the object, and no run on 7.40 has sent `request`. The same
 * shape as {@link legacyRefusal}; no request is sent, and the words claim
 * nothing about the endpoint beyond that.
 */
export function legacyNotMeasuredRefusal<T, E extends IAdtError = IAdtError>(
  operation: string,
  request: string,
): IAdtResponse<T, E> {
  // The library's own verdict, as in legacyRefusal.
  return failed<T, E>({
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message: `${operation}: refused until measured: no run on a legacy system (7.40 SP04) has sent ${request}.`,
  } as E);
}

/**
 * 7.40 SP04 has no deletion API: `POST /sap/bc/adt/deletion/check` answered
 * `404` "No application class found for URI" over RFC (spec §5).
 */
export const DELETION_CHECK = '/sap/bc/adt/deletion/check';
export const DELETION_DELETE = '/sap/bc/adt/deletion/delete';

/**
 * `checkDeletion` of a handler whose legacy `delete` is the DELETE under the
 * caller's lock (§4.2) — and the refusal of `checkDeletionGroup` (§5), which
 * points to the same delete.
 */
export function noDeletionCheck<T, E extends IAdtError = IAdtError>(
  operation = 'checkDeletion',
): IAdtResponse<T, E> {
  return legacyRefusal<T, E>(
    operation,
    DELETION_CHECK,
    "There is no deletion check on 7.40: delete() with the object's lock handle, from lock(), is the delete.",
  );
}

/**
 * `checkDeletion` of a handler whose legacy `delete` is refused too (§4.3,
 * §8): there is no deletion check, and no delete to point to.
 */
export function noDeletionCheckNorDelete<T, E extends IAdtError = IAdtError>(
  operation = 'checkDeletion',
): IAdtResponse<T, E> {
  return legacyRefusal<T, E>(
    operation,
    DELETION_CHECK,
    'There is no deletion check on 7.40, and this handler refuses delete() as well.',
  );
}

/** A delete that goes through `/sap/bc/adt/deletion/*` (§4.3). */
export function noDeletionApi<T, E extends IAdtError = IAdtError>(
  operation = 'delete',
  instead?: string,
): IAdtResponse<T, E> {
  return legacyRefusal<T, E>(operation, DELETION_DELETE, instead);
}
