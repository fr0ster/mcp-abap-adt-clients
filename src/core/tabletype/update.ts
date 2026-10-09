/**
 * TableType update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (valueHelps, etc.)
 * that would be lost if XML were built from scratch.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_TABLE_TYPE } from '../../constants/contentTypes';
import { TABLE_TYPE } from '../../endpoints/objects';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateTableTypeParams } from './types';

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
export async function updateTableType(
  connection: IAbapConnection,
  params: IUpdateTableTypeParams,
  document: string,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const url = `${TABLE_TYPE.uri(params.tabletype_name.toUpperCase())}${writeQuery(lockHandle, params.transport_request)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: { Accept: CT_TABLE_TYPE, 'Content-Type': CT_TABLE_TYPE },
  });
}
