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
import {
  type DocumentEdit,
  type DocumentPatch,
  digits,
  patchDocument,
} from '../shared/documentPatch';

/** What a patch may change; a field left `undefined` is not touched. */
export interface IDomainChanges {
  /** The root's `adtcore:description`, passed as given. */
  readonly description?: string;
  readonly dataType?: string;
  /** Written as SAP's six digits. */
  readonly length?: number;
  readonly conversionExit?: string;
}

const ROOT = 'doma:domain';
const TYPE_INFORMATION = ['doma:content', 'doma:typeInformation'];
const OUTPUT_INFORMATION = ['doma:content', 'doma:outputInformation'];

type Field = keyof IDomainChanges;

/** The domain's document with `changes` written, or why it cannot be. */
export function patchDomainDocument(
  document: string,
  changes: IDomainChanges,
): DocumentPatch<Field> {
  const edits: DocumentEdit<Field>[] = [];
  if (changes.description !== undefined) {
    edits.push({
      field: 'description',
      path: [],
      kind: 'attribute',
      name: 'adtcore:description',
      value: changes.description,
    });
  }
  if (changes.dataType !== undefined) {
    edits.push({
      field: 'dataType',
      path: [...TYPE_INFORMATION, 'doma:datatype'],
      kind: 'text',
      value: changes.dataType,
    });
  }
  if (changes.length !== undefined) {
    edits.push({
      field: 'length',
      path: [...TYPE_INFORMATION, 'doma:length'],
      kind: 'text',
      value: digits(changes.length, 6),
    });
  }
  if (changes.conversionExit !== undefined) {
    edits.push({
      field: 'conversionExit',
      path: [...OUTPUT_INFORMATION, 'doma:conversionExit'],
      kind: 'text',
      value: changes.conversionExit,
    });
  }
  return patchDocument(document, ROOT, edits);
}
