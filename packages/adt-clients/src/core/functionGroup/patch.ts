/**
 * The function group's document patch: the description on
 * `group:abapFunctionGroup`, and nothing else.
 *
 * The description is passed as given: SAP stores what fits
 * (`adtcore:descriptionTextLimit="40"` on the measured reads) and cuts the
 * rest itself.
 */
import {
  DocumentEdits,
  type DocumentPatch,
  patchDocument,
} from '../shared/documentPatch';

/** What a patch may change; a field left `undefined` is not touched. */
export interface IFunctionGroupChanges {
  /** The root's `adtcore:description`, passed as given. */
  readonly description?: string;
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
