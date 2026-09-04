/**
 * Boundary and request ids for the ABAP debugger's own batch endpoint.
 *
 * `POST /sap/bc/adt/debugger/batch` is a real ADT resource — the debugger sends
 * a step and a stack read in one round-trip, and the server answers both. It has
 * nothing to do with the batch *clients* removed in this migration: those tried
 * to put mixed GET and POST from unrelated resources into one envelope, which is
 * a server-side 500, and were research rather than product.
 *
 * These two helpers lived in `src/batch/buildBatchPayload.ts` and moved here
 * when it went, because this is the only thing that still needs them.
 */

/** A multipart boundary, unique per payload. */
export function createBatchBoundary(): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `batch_${randomPart}`;
}

/** A 32-character request id, which the debugger correlates its parts by. */
export function createRequestId(): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}${Math.random().toString(16).slice(2)}`;
  return randomPart.slice(0, 32);
}
