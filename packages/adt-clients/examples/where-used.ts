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

import type { AdtTypeCode, IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { AdtClient } from '../src/clients/AdtClient';

// Since 36.0.0 a request's Accept and Content-Type are the caller's
// (`options.headers`): the member sends exactly this pair. These are the ones
// 35.0.0 chose for itself on a modern system.
const WHERE_USED_SCOPE: IAdtHeaders = {
  accept:
    'application/vnd.sap.adt.repository.usagereferences.scope.response.v1+xml',
  contentType:
    'application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml',
};
const WHERE_USED: IAdtHeaders = {
  accept: 'application/vnd.sap.adt.repository.usagereferences.result.v1+xml',
  contentType:
    'application/vnd.sap.adt.repository.usagereferences.request.v1+xml',
};

export async function whereUsed(
  client: AdtClient,
  objectName: string,
  objectType: AdtTypeCode = 'CLAS/OC',
  searchOnlyIn?: string[],
): Promise<string> {
  const utils = client.getUtils();

  const scope = await utils.getWhereUsedScope(
    {
      object_name: objectName,
      object_type: objectType,
    },
    { headers: WHERE_USED_SCOPE },
  );
  if (!scope.ok) throw new Error(scope.getError().message);

  let scopeXml = String(scope.getResult().value ?? '');
  if (searchOnlyIn?.length) {
    scopeXml = utils.modifyWhereUsedScope(scopeXml, {
      enableOnly: searchOnlyIn,
    });
  }

  const found = await utils.getWhereUsed(
    {
      object_name: objectName,
      object_type: objectType,
      scopeXml,
    },
    { headers: WHERE_USED },
  );
  if (!found.ok) throw new Error(found.getError().message);

  // The document, because that is the shipped default. For a parsed reference
  // list, construct the utils with `utilWhereUsedReferences` from
  // @mcp-abap-adt/adt-strategies as the `whereUsed` reading:
  // `client.getUtils({ ...utilDocuments, whereUsed: utilWhereUsedReferences })`.
  return String(found.getResult().value ?? '');
}
