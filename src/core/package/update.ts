/**
 * Package update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (abapLanguageVersion, etc.)
 * that would be lost if XML were built from scratch.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  IUpdatePackageParams,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_PACKAGE, CT_PACKAGE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Write the document the caller built.
 *
 * **One request.** This used to GET the current document, patch the named
 * fields into it, and PUT the result — two requests in one member, and a merge
 * whose rules nobody outside could change. A caller reads the document with the
 * member that reads it, edits it, and passes it here, which is also where the
 * guarantee that it is valid belongs.
 *
 * A field left out of `document` is not preserved: nothing was read to preserve
 * it from.
 */
export async function updatePackage(
  connection: IAbapConnection,
  params: IUpdatePackageParams,
  document: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(params.package_name.toLowerCase());
  const corrNrParam = params.transport_request
    ? `&corrNr=${params.transport_request}`
    : '';
  const url = `/sap/bc/adt/packages/${encodedName}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: { 'Content-Type': CT_PACKAGE, Accept: ACCEPT_PACKAGE },
  });
}
