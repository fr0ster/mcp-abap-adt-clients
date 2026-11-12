/**
 * The domain's document patch: the document `readMetadata` answered, with the
 * fields the caller names changed — and nothing else.
 *
 * Read, patch, write — three calls, the caller's:
 *
 * ```ts
 * const read = await domain.readMetadata({ domainName });
 * const patched = patchDomainDocument(read.getResult().value, { description });
 * if (patched.ok) await domain.updateMetadata(config, { …, source: patched.document });
 * ```
 */

import { escapeXmlText } from '../../utils/xml';
import {
  DocumentEdits,
  type DocumentPatch,
  digits,
  patchDocument,
} from '../shared/documentPatch';

/** One fixed value of a domain. */
export interface IDomainFixedValue {
  readonly low: string;
  /** Absent: `<doma:high/>`. */
  readonly high?: string | undefined;
  readonly text: string;
}

/** What a patch may change; a field left `undefined` is not touched. */
export interface IDomainChanges {
  /** The root's `adtcore:description`, passed as given. */
  readonly description?: string | undefined;
  readonly dataType?: string | undefined;
  /** The type length (`typeInformation`), written as SAP's six digits. */
  readonly length?: number | undefined;
  /** Written as SAP's six digits. */
  readonly decimals?: number | undefined;
  readonly conversionExit?: string | undefined;
  readonly signExists?: boolean | undefined;
  readonly lowercase?: boolean | undefined;
  /** The value table's name; the reference keeps nothing of the old one. */
  readonly valueTable?: string | undefined;
  /** Replaces every fixed value; `[]` leaves none. */
  readonly fixedValues?: ReadonlyArray<IDomainFixedValue> | undefined;
}

const ROOT = 'doma:domain';
const TYPE_INFORMATION = ['doma:content', 'doma:typeInformation'];
const OUTPUT_INFORMATION = ['doma:content', 'doma:outputInformation'];
const VALUE_INFORMATION = ['doma:content', 'doma:valueInformation'];

type Field = keyof IDomainChanges;

/** An element with its text, `<x/>` when empty. */
function element(name: string, value: string): string {
  return value === ''
    ? `<${name}/>`
    : `<${name}>${escapeXmlText(value)}</${name}>`;
}

/** The `doma:fixValues` content: one `doma:fixValue` per entry, 1-based. */
function fixValuesXml(values: ReadonlyArray<IDomainFixedValue>): string {
  return values
    .map(
      (value, index) =>
        '<doma:fixValue>' +
        element('doma:position', digits(index + 1, 4)) +
        element('doma:low', value.low) +
        element('doma:high', value.high ?? '') +
        element('doma:text', value.text) +
        '</doma:fixValue>',
    )
    .join('');
}

/** The domain's document with `changes` written, or why it cannot be. */
export function patchDomainDocument(
  document: string,
  changes: IDomainChanges,
): DocumentPatch<Field> {
  const edits = new DocumentEdits<Field>()
    .attribute('description', [], 'adtcore:description', changes.description)
    .text('dataType', [...TYPE_INFORMATION, 'doma:datatype'], changes.dataType)
    .digits('length', [...TYPE_INFORMATION, 'doma:length'], changes.length, 6)
    .digits(
      'decimals',
      [...TYPE_INFORMATION, 'doma:decimals'],
      changes.decimals,
      6,
    )
    .text(
      'conversionExit',
      [...OUTPUT_INFORMATION, 'doma:conversionExit'],
      changes.conversionExit,
    )
    .flag(
      'signExists',
      [...OUTPUT_INFORMATION, 'doma:signExists'],
      changes.signExists,
    )
    .flag(
      'lowercase',
      [...OUTPUT_INFORMATION, 'doma:lowercase'],
      changes.lowercase,
    )
    .reference(
      'valueTable',
      [...VALUE_INFORMATION, 'doma:valueTableRef'],
      changes.valueTable,
    )
    .content(
      'fixedValues',
      [...VALUE_INFORMATION, 'doma:fixValues'],
      changes.fixedValues === undefined
        ? undefined
        : fixValuesXml(changes.fixedValues),
    );
  return patchDocument(document, ROOT, edits.list);
}
