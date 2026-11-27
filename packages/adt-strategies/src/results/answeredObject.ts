/**
 * A type code read from an ADT answer, looked up once against the ADT type
 * tables of `@mcp-abap-adt/interfaces-adt`.
 *
 * A code a table names is answered as its `type`; any other text — a code no
 * table holds (`PROG/PS`, `CLAS/OM`), or a code of a newer release — as
 * `unknownType`, the text exactly as ADT sent it, so nothing is lost and a
 * consumer that switches on `type` has every code it can act on. The tables
 * of every variant are read: an answer does not say which release sent it.
 */

import {
  ADT_TYPES_BASIS_740,
  ADT_TYPES_CLOUD,
  ADT_TYPES_ONPREM,
  type AdtTypeCode,
  type IAdtAnsweredObject,
} from '@mcp-abap-adt/interfaces-adt';

type Entry = { readonly codes: object };

/** The codes one table names, each typed as the code it is. */
type CodesOfTable<T extends { readonly [A in keyof T]: Entry }> = {
  [A in keyof T]: Extract<keyof T[A]['codes'], string>;
}[keyof T];

/**
 * The keys of one entry's codes. `for … in` over a generic object yields its
 * keys as `Extract<keyof C, string>`, so no code is retyped by hand.
 */
function keysOf<C extends object>(codes: C): Extract<keyof C, string>[] {
  const keys: Extract<keyof C, string>[] = [];
  for (const code in codes) keys.push(code);
  return keys;
}

/** Every code of one table, typed by the table. */
function codesIn<T extends { readonly [A in keyof T]: Entry }>(
  table: T,
): CodesOfTable<T>[] {
  const codes: CodesOfTable<T>[] = [];
  for (const api in table) codes.push(...keysOf(table[api].codes));
  return codes;
}

/** Every code of every table, looked up by its text. */
const CODES: ReadonlyMap<string, AdtTypeCode> = (() => {
  const codes = new Map<string, AdtTypeCode>();
  for (const code of [
    ...codesIn(ADT_TYPES_ONPREM),
    ...codesIn(ADT_TYPES_CLOUD),
    ...codesIn(ADT_TYPES_BASIS_740),
  ])
    codes.set(code, code);
  return codes;
})();

/** The code ADT sent, as the tables know it or as it came. */
export function answeredObject(text: string): IAdtAnsweredObject {
  const type = CODES.get(text);
  return type !== undefined ? { type } : { unknownType: text };
}
