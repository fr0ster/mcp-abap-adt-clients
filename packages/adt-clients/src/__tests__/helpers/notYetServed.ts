/**
 * The APIs `@mcp-abap-adt/interfaces-adt` 34.0.0's tables name that this
 * package does not serve yet, and their codes. 34.0.0 carries the rows of
 * several tasks released at once; type groups (fr0ster/mcp-abap-adt-clients
 * #335) are still to come, the application log and job catalog/template reads
 * are served (fr0ster/mcp-abap-adt#404).
 *
 * Every exhaustive check over the tables leaves exactly these out, and
 * `notYetServed.test.ts` fails as soon as one of them is served, so the entry
 * leaves this list with the factory that serves it.
 */
import type { AdtApiName, AdtTypeCode } from '@mcp-abap-adt/interfaces-adt';

export const NOT_YET_SERVED = [
  'typeGroup',
] as const satisfies readonly AdtApiName[];

export type NotYetServedApi = (typeof NOT_YET_SERVED)[number];

export const NOT_YET_SERVED_CODES = [
  'TYPE/DG',
] as const satisfies readonly AdtTypeCode[];

export type NotYetServedCode = (typeof NOT_YET_SERVED_CODES)[number];
