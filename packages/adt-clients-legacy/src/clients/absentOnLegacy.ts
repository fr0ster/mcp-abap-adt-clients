/**
 * A handler for an object type a legacy system (SAP_BASIS 7.40, measured on 7.40 SP04) does not have at
 * all.
 *
 * The legacy client still hands one out, so a caller of `AdtClient` that is
 * given the legacy client carries on instead of crashing at the factory. Every
 * member answers the same refusal and sends no request: the endpoint is
 * not served (missing from the system's discovery or, where discovery is
 * silent, answered `404` when measured), so a request could only be refused
 * by SAP for a reason already known here. Decision 11, "The exception:
 * legacy endpoints".
 */

import { failed } from '@mcp-abap-adt/adt-clients';
import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';

/** What a type's refusal rests on: a measurement, or absence from discovery. */
export type AbsenceEvidence = 'measured' | 'not-advertised';

/** The members of a class, read from its prototype chain. */
function membersOf(implementation: abstract new (...args: never[]) => unknown) {
  const names = new Set<string>();
  let proto: object | null = implementation.prototype;
  while (proto && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      const descriptor = Object.getOwnPropertyDescriptor(proto, name);
      if (name !== 'constructor' && typeof descriptor?.value === 'function') {
        names.add(name);
      }
    }
    proto = Object.getPrototypeOf(proto);
  }
  return names;
}

/**
 * Build a handler whose members are those of `implementation`, the modern
 * handler of the type, each answering a refusal. Every member of the handlers
 * this is used for is asynchronous and answers an `IAdtResponse`, so the
 * refusal takes the same shape the modern member would answer with.
 *
 * `objectType` must be that handler's `objectType` value: it is also the one
 * data member the handlers declare, and the test compares the two.
 *
 * `evidence` is what the refusal rests on, and the message says which:
 * `'measured'` — 7.40 SP04 answered `404` for the endpoint over RFC;
 * `'not-advertised'` — the endpoint is only absent from 7.40 SP04's discovery,
 * not measured, so the type is refused until a run measures it.
 */
export function absentOnLegacy<T>(
  implementation: abstract new (...args: never[]) => unknown,
  objectType: string,
  endpoint: string,
  evidence: AbsenceEvidence,
): T {
  const why =
    evidence === 'measured'
      ? `a legacy system (7.40 SP04) was measured not to serve ${endpoint}, ` +
        'the endpoint this type needs.'
      : `${endpoint}, the endpoint this type needs, is absent from the ` +
        'discovery of a legacy system (7.40 SP04): not advertised, not ' +
        'measured, so the type is refused until a run measures it.';
  const refusal: IAdtError = {
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message: `${objectType} is not supported on this SAP system: ${why}`,
  };
  const handler: Record<string, unknown> = {};
  for (const name of membersOf(implementation)) {
    handler[name] = async (): Promise<IAdtResponse<never>> =>
      failed<never>(refusal);
  }
  // The one data member the handlers declare. `objectType` is the modern
  // handler's own value, so a caller reading it gets what it would get there.
  handler.objectType = objectType;
  return handler as T;
}
