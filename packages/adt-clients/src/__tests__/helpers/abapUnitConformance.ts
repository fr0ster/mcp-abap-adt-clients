/**
 * The conformance check's ABAP Unit rules (spec 3.5): the run registry
 * `ABAP_UNIT_RUN_TYPES` of `@mcp-abap-adt/interfaces-adt` held against a
 * release's `GET /sap/bc/adt/abapunit/metadata` answer.
 *
 * Two rules, per release that has an answer:
 *
 * - `unregistered` — a `globalWorkbenchType` the metadata lists that is no
 *   key of the registry: a type ABAP Unit says it runs, which the run type
 *   (`AbapUnitRunObjectType`) does not let a caller name;
 * - `unlisted` — a key the registry enters on the metadata's evidence
 *   (`'metadata'`, or `'metadataRunEmpty'`: listed, a run answered empty)
 *   that the metadata does not list: an entry whose evidence is gone.
 *
 * A key entered as `'recorded'` rests on a measured run, not on the metadata,
 * so its absence from the metadata (`CLAS`, `PROG`, `FUGR`, `FUNC`, `DDLS`)
 * is no conflict.
 *
 * The answer is data from outside the type system, read with runtime checks;
 * the registry is typed and read as typed.
 */

import type { AbapUnitRunTypeTable } from '@mcp-abap-adt/interfaces-adt';
import { parseAnswer } from './typeTableConformance';
import { attributeOf, elementsNamed } from './xmlTree';

/** Which ABAP Unit rule a conflict breaks. */
export type AbapUnitConformanceRule = 'unregistered' | 'unlisted';

export interface IAbapUnitConflict {
  readonly rule: AbapUnitConformanceRule;
  readonly code: string;
}

/**
 * The `globalWorkbenchType` of every `supportedTypeFeatures` of an
 * `/abapunit/metadata` answer, in document order. A document with none, an
 * entry without the attribute, or a code twice throws.
 */
export function readAbapUnitMetadata(xml: string): string[] {
  const features = elementsNamed(
    parseAnswer(xml, 'abapunit metadata'),
    'supportedTypeFeatures',
  );
  if (features.length === 0) {
    throw new Error('abapunit metadata: no supportedTypeFeatures');
  }
  const codes: string[] = [];
  for (const feature of features) {
    const code = attributeOf(feature, 'globalWorkbenchType');
    if (!code) {
      throw new Error(
        'abapunit metadata: a supportedTypeFeatures without globalWorkbenchType',
      );
    }
    if (codes.includes(code)) {
      throw new Error(`abapunit metadata: ${code} twice`);
    }
    codes.push(code);
  }
  return codes;
}

/** Every conflict of the registry with one release's listed codes, sorted. */
export function checkAbapUnitRunTypes(
  registry: AbapUnitRunTypeTable,
  listed: readonly string[],
): IAbapUnitConflict[] {
  const conflicts: IAbapUnitConflict[] = [];
  for (const code of listed) {
    if (!Object.hasOwn(registry, code)) {
      conflicts.push({ rule: 'unregistered', code });
    }
  }
  for (const [code, facts] of Object.entries(registry)) {
    if (facts.evidence !== 'recorded' && !listed.includes(code)) {
      conflicts.push({ rule: 'unlisted', code });
    }
  }
  return conflicts.sort(
    (a, b) => a.rule.localeCompare(b.rule) || a.code.localeCompare(b.code),
  );
}
