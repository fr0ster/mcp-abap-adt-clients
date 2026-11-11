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
import { escapeText } from '../../utils/documentEdit';
import {
  type DocumentEdit,
  type DocumentPatch,
  digits,
  patchDocument,
} from '../shared/documentPatch';

/** One fixed value of a domain. */
export interface IDomainFixedValue {
  readonly low: string;
  /** Absent: `<doma:high/>`. */
  readonly high?: string;
  readonly text: string;
}

/** What a patch may change; a field left `undefined` is not touched. */
export interface IDomainChanges {
  /** The root's `adtcore:description`, passed as given. */
  readonly description?: string;
  readonly dataType?: string;
  /** The type length (`typeInformation`), written as SAP's six digits. */
  readonly length?: number;
  /** Written as SAP's six digits. */
  readonly decimals?: number;
  readonly conversionExit?: string;
  readonly signExists?: boolean;
  readonly lowercase?: boolean;
  /** The value table's name; the reference keeps nothing of the old one. */
  readonly valueTable?: string;
  /** Replaces every fixed value; `[]` leaves none. */
  readonly fixedValues?: ReadonlyArray<IDomainFixedValue>;
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
    : `<${name}>${escapeText(value)}</${name}>`;
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
  const edits: DocumentEdit<Field>[] = [];
  const text = (field: Field, path: string[], value: string | undefined) => {
    if (value !== undefined) edits.push({ field, path, kind: 'text', value });
  };
  if (changes.description !== undefined) {
    edits.push({
      field: 'description',
      path: [],
      kind: 'attribute',
      name: 'adtcore:description',
      value: changes.description,
    });
  }
  text('dataType', [...TYPE_INFORMATION, 'doma:datatype'], changes.dataType);
  text(
    'length',
    [...TYPE_INFORMATION, 'doma:length'],
    changes.length === undefined ? undefined : digits(changes.length, 6),
  );
  text(
    'decimals',
    [...TYPE_INFORMATION, 'doma:decimals'],
    changes.decimals === undefined ? undefined : digits(changes.decimals, 6),
  );
  text(
    'conversionExit',
    [...OUTPUT_INFORMATION, 'doma:conversionExit'],
    changes.conversionExit,
  );
  text(
    'signExists',
    [...OUTPUT_INFORMATION, 'doma:signExists'],
    changes.signExists === undefined ? undefined : String(changes.signExists),
  );
  text(
    'lowercase',
    [...OUTPUT_INFORMATION, 'doma:lowercase'],
    changes.lowercase === undefined ? undefined : String(changes.lowercase),
  );
  if (changes.valueTable !== undefined) {
    edits.push({
      field: 'valueTable',
      path: [...VALUE_INFORMATION, 'doma:valueTableRef'],
      kind: 'reference',
      name: changes.valueTable,
    });
  }
  if (changes.fixedValues !== undefined) {
    edits.push({
      field: 'fixedValues',
      path: [...VALUE_INFORMATION, 'doma:fixValues'],
      kind: 'content',
      xml: fixValuesXml(changes.fixedValues),
    });
  }
  return patchDocument(document, ROOT, edits);
}
