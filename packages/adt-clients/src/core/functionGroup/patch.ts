/**
 * The function group's document patch: the description on
 * `group:abapFunctionGroup`, and nothing else.
 *
 * The description is passed as given, with no check of its length. SAP holds
 * 40 characters (`adtcore:descriptionTextLimit="40"` on the measured reads)
 * and refuses a longer one with `400` `FUNC_ADT/103`, storing nothing
 * (measured on cloud and on premise); that answer reaches the caller as is.
 */
import {
  DocumentEdits,
  type DocumentPatch,
  patchDocument,
} from '../shared/documentPatch';

/** What a patch may change; a field left `undefined` is not touched. */
export interface IFunctionGroupChanges {
  /** The root's `adtcore:description`, passed as given. */
  readonly description?: string | undefined;
}

/** The function group's document with `changes` written, or why it cannot be. */
export function patchFunctionGroupDocument(
  document: string,
  changes: IFunctionGroupChanges,
): DocumentPatch<keyof IFunctionGroupChanges> {
  const edits = new DocumentEdits<keyof IFunctionGroupChanges>().attribute(
    'description',
    [],
    'adtcore:description',
    changes.description,
  );
  return patchDocument(document, 'group:abapFunctionGroup', edits.list);
}
