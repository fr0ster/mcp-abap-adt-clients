/**
 * The refusal a legacy handler answers for an operation SAP_BASIS 7.40 does
 * not serve (spec §2.1): answered through `failed()`, never thrown, with
 * `origin: 'refusal'` and `AdtObjectErrorCodes.UNSUPPORTED_OPERATION`, and a
 * message naming the operation, the endpoint 7.40 lacks and — where there is
 * one — what to use instead. No request is sent, so `options.analyse` has
 * nothing to read.
 */

import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { failed } from '../../utils/adtResponse';

/** `operation` refused: SAP_BASIS 7.40 has no `endpoint`; `instead`, if any. */
export function legacyRefusal<T, E extends IAdtError = IAdtError>(
  operation: string,
  endpoint: string,
  instead?: string,
): IAdtResponse<T, E> {
  const message = `${operation}: a legacy system (SAP_BASIS 7.40) has no ${endpoint}.`;
  // The library's own verdict, so `E` is its default `IAdtError` here — the
  // same cast `answering` makes when no strategy supplied one.
  return failed<T, E>({
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message: instead ? `${message} ${instead}` : message,
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
