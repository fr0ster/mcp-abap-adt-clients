/**
 * The types of an answer's headers, as the connection contract declares them.
 *
 * A header map read by name is this record, not `Record<string, unknown>`: the
 * values are the contract's (`string`, a list of strings, a number, …), and a
 * reader narrows them from that type, with no cast (#304).
 */
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';

/** One header's value as the contract types it. */
export type AdtHeaderValue = IAdtWireResponse['headers'][string];

/** An answer's headers, read by name. */
export type AdtHeaderMap = Readonly<Record<string, AdtHeaderValue>>;

/**
 * A list's first item, as the `unknown` a list from outside holds. A header
 * the transport gave as a list is read by its first value; `Array.isArray` on
 * such a value yields `any[]`, and this keeps its item out of `any`.
 */
export function firstOf(list: readonly unknown[]): unknown {
  return list[0];
}
