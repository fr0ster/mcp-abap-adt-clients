/**
 * Where-used — **this is what `getWhereUsedList` used to do.**
 *
 * ADT exposes this as two endpoints and an edit between them, and that member
 * did all three — so the scope was never yours to narrow, and the result shape
 * was fixed at a parsed reference list.
 *
 * `modifyWhereUsedScope` makes no request: it edits the document you were
 * handed. That is why it is the one member here that answers a plain string.
 */

import type { AdtClient } from '../src/clients/AdtClient';

export async function whereUsed(
  client: AdtClient,
  objectName: string,
  objectType = 'class',
  searchOnlyIn?: string[],
): Promise<string> {
  const utils = client.getUtils();

  const scope = await utils.getWhereUsedScope({
    object_name: objectName,
    object_type: objectType,
  });
  if (!scope.ok) throw new Error(scope.getError().message);

  let scopeXml = String(scope.getResult().value ?? '');
  if (searchOnlyIn?.length) {
    scopeXml = utils.modifyWhereUsedScope(scopeXml, {
      enableOnly: searchOnlyIn,
    });
  }

  const found = await utils.getWhereUsed({
    object_name: objectName,
    object_type: objectType,
    scopeXml,
  });
  if (!found.ok) throw new Error(found.getError().message);

  // The document, because that is the shipped default. For a parsed reference
  // list, construct the utils with `whereUsedReferences` as the `whereUsed`
  // reading: `client.getUtils({ ...utilDocuments, whereUsed: whereUsedReferences })`.
  return String(found.getResult().value ?? '');
}
