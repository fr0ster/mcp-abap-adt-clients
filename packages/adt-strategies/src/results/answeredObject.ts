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

/** Every code of every table. */
const CODES: ReadonlySet<string> = new Set(
  [ADT_TYPES_ONPREM, ADT_TYPES_CLOUD, ADT_TYPES_BASIS_740].flatMap((table) =>
    Object.values(table).flatMap((entry) => Object.keys(entry.codes)),
  ),
);

function isAdtTypeCode(text: string): text is AdtTypeCode {
  return CODES.has(text);
}

/** The code ADT sent, as the tables know it or as it came. */
export function answeredObject(text: string): IAdtAnsweredObject {
  return isAdtTypeCode(text) ? { type: text } : { unknownType: text };
}
