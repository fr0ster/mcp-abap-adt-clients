/**
 * A handler for an object type a legacy system (BASIS < 7.50) does not have at
 * all.
 *
 * The legacy client still hands one out, so a caller of `AdtClient` that is
 * given the legacy client carries on instead of crashing at the factory. Every
 * member answers the same refusal and sends no request: the endpoint is absent
 * from the system's discovery catalog, so a request could only be refused by
 * SAP for a reason already known here. Decision 11, "The exception: legacy
 * endpoints".
 */

import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';
import { failed } from '../utils/adtResponse';

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
 */
export function absentOnLegacy<T>(
  implementation: abstract new (...args: never[]) => unknown,
  objectType: string,
  endpoint: string,
): T {
  const refusal: IAdtError = {
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message:
      `${objectType} is not supported on this SAP system. ` +
      `The required endpoint ${endpoint} was not found in the system's ` +
      'ADT discovery catalog (/sap/bc/adt/discovery). ' +
      "This typically means the system's BASIS version is too old.",
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
