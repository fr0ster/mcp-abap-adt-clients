/**
 * Where a reference leads — what `AdtUtils.getNavigationTarget` answers
 * (`POST /sap/bc/adt/navigation/target?uri=…`), read.
 *
 * Measured on ABAP cloud and on premise (2026-11-28): an outline's name
 * fragment answers `200` with one `adtcore:objectReference` whose
 * `adtcore:uri` is `<include>#start=line,column` — the line of the element's
 * statement, the column of its name; the end is not given. A refusal (a
 * local method's definition link on the cloud: `400`, an `exc:exception`)
 * carries no reference.
 *
 * A document with no `adtcore:objectReference`, or one whose uri has no
 * readable `start`, reads as no target; whether it was a refusal is the error
 * strategy's question.
 */

import type { IResultStrategy } from '@mcp-abap-adt/interfaces-adt';
import { XMLParser } from 'fast-xml-parser';
import { field, leafText, parsedOrNothing } from '../parsed';
import { rawOf } from '../result';
import { readSourceReference } from '../sourcePosition';
import type { IOutlinePoint } from './outline';

/** Where a reference leads: the include and the start in it. */
export interface INavigationTarget {
  /** The reference's uri before `#`: the include the start is in. */
  include: string;
  /** `start` of the `#start=l,c` fragment: line from 1, column from 0. */
  start: IOutlinePoint;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: true,
});

/** A navigation answer's document, read; `undefined` when it names no start. */
export function readNavigationTarget(
  xml: string,
): INavigationTarget | undefined {
  if (!xml.trim()) return undefined;
  const parsed: unknown = parsedOrNothing(parser, xml);
  const reference = field(parsed, 'adtcore:objectReference');
  const uri = leafText(field(reference, '@_adtcore:uri'));
  const { uri: include, position } = readSourceReference(uri);
  if (include === undefined || position === undefined) return undefined;
  return {
    include,
    start: { line: position.line, column: position.column },
  };
}

/** {@link readNavigationTarget} as a result strategy, for a caller's set. */
export const navigationTarget: IResultStrategy<
  INavigationTarget | undefined
> = (answer) => readNavigationTarget(rawOf(answer));
