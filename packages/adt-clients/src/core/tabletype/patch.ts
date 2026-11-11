/**
 * The table type's document patch: the document `readMetadata` answered,
 * with the fields the caller names changed — and nothing else.
 *
 * Every field is found by its path from `ttyp:tableType`: the primary key's
 * `ttyp:definition` and `ttyp:kind` are `ttyp:primaryKey`'s, never a
 * secondary key's of the same names, and the `ttyp:valueHelps` (each with a
 * `ttyp:description` of its own) are never touched.
 */
import {
  DocumentEdits,
  type DocumentPatch,
  patchDocument,
} from '../shared/documentPatch';

/** What a patch may change; a field left `undefined` is not touched. */
export interface ITableTypeChanges {
  /** The root's `adtcore:description`, passed as given. */
  readonly description?: string;
  /** `ttyp:rowType/ttyp:typeKind`. */
  readonly rowTypeKind?: string;
  /** `ttyp:rowType/ttyp:typeName`. */
  readonly rowTypeName?: string;
  /** The built-in type's data type. */
  readonly dataType?: string;
  /** The built-in type's length, SAP's six digits. */
  readonly length?: number;
  /** The built-in type's decimals, SAP's six digits. */
  readonly decimals?: number;
  readonly accessType?: string;
  /** `ttyp:primaryKey/ttyp:definition`. */
  readonly keyDefinition?: string;
  /** `ttyp:primaryKey/ttyp:kind`. */
  readonly keyKind?: string;
}

const ROOT = 'ttyp:tableType';
const ROW_TYPE = ['ttyp:rowType'];
const BUILT_IN = ['ttyp:rowType', 'ttyp:builtInType'];
const PRIMARY_KEY = ['ttyp:primaryKey'];

/** The table type's document with `changes` written, or why it cannot be. */
export function patchTableTypeDocument(
  document: string,
  changes: ITableTypeChanges,
): DocumentPatch<keyof ITableTypeChanges> {
  const edits = new DocumentEdits<keyof ITableTypeChanges>()
    .attribute('description', [], 'adtcore:description', changes.description)
    .text('rowTypeKind', [...ROW_TYPE, 'ttyp:typeKind'], changes.rowTypeKind)
    .text('rowTypeName', [...ROW_TYPE, 'ttyp:typeName'], changes.rowTypeName)
    .text('dataType', [...BUILT_IN, 'ttyp:dataType'], changes.dataType)
    .digits('length', [...BUILT_IN, 'ttyp:length'], changes.length, 6)
    .digits('decimals', [...BUILT_IN, 'ttyp:decimals'], changes.decimals, 6)
    .text('accessType', ['ttyp:accessType'], changes.accessType)
    .text(
      'keyDefinition',
      [...PRIMARY_KEY, 'ttyp:definition'],
      changes.keyDefinition,
    )
    .text('keyKind', [...PRIMARY_KEY, 'ttyp:kind'], changes.keyKind);
  return patchDocument(document, ROOT, edits.list);
}
