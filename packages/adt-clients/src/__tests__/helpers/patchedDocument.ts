/**
 * The document a shipped patch returned, or a test failure naming its refusal.
 *
 * A patch answers a refusal instead of throwing; a test step that cannot go
 * on without the document stops here, saying which field had nowhere to go.
 */
import type { DocumentPatch } from '../../core/shared/documentPatch';

export function patchedDocument<F extends string>(
  answer: DocumentPatch<F>,
  what: string,
): string {
  if (answer.ok) return answer.document;
  const { refusal } = answer;
  switch (refusal.kind) {
    case 'not-a-document':
      throw new Error(`${what}: the read is not a document`);
    case 'not-this-type':
      throw new Error(`${what}: the document's root is ${refusal.root}`);
    case 'element-missing':
      throw new Error(
        `${what}: ${refusal.field} has nowhere to go, ${refusal.path} is missing`,
      );
  }
}
