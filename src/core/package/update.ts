/**
 * Package update operations — one PUT of the document the caller built.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_PACKAGE, CT_PACKAGE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdatePackageParams } from './types';

/**
 * Write the document the caller built.
 *
 * **One request.** This used to GET the current document, patch the named
 * fields into it, and PUT the result — two requests in one member, and a merge
 * whose rules nobody outside could change. A caller reads the document with the
 * member that reads it, edits it, and passes it here, which is also where the
 * guarantee that it is valid belongs.
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updatePackage(
  connection: IAbapConnection,
  params: IUpdatePackageParams,
  document: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(params.package_name.toLowerCase());
  // `writeQuery`, like every other write: interpolating the handle directly
  // sent `?lockHandle=undefined` when there was none, and SAP answered a
  // refusal about a handle nobody passed.
  const url = `/sap/bc/adt/packages/${encodedName}${writeQuery(lockHandle, params.transport_request)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: { 'Content-Type': CT_PACKAGE, Accept: ACCEPT_PACKAGE },
  });
}
