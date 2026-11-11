/**
 * The message class's document patch: the description on `mc:messageClass`,
 * and nothing else.
 *
 * The messages (`mc:messages`) are rows inside the same document; this patch
 * writes none of them — a message is changed through
 * `AdtMessageClassMessage`.
 */
import {
  DocumentEdits,
  type DocumentPatch,
  patchDocument,
} from '../shared/documentPatch';

/** What a patch may change; a field left `undefined` is not touched. */
export interface IMessageClassChanges {
  /** The root's `adtcore:description`, passed as given. */
  readonly description?: string;
}

/** The message class's document with `changes` written, or why it cannot be. */
export function patchMessageClassDocument(
  document: string,
  changes: IMessageClassChanges,
): DocumentPatch<keyof IMessageClassChanges> {
  const edits = new DocumentEdits<keyof IMessageClassChanges>().attribute(
    'description',
    [],
    'adtcore:description',
    changes.description,
  );
  return patchDocument(document, 'mc:messageClass', edits.list);
}
