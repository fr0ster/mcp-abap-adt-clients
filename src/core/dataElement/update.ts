/**
 * DataElement update operations — one PUT of the document the caller built.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_DATA_ELEMENT } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateDataElementParams } from './types';

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
export async function updateDataElement(
  connection: IAbapConnection,
  params: IUpdateDataElementParams,
  document: string,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(
    params.data_element_name.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/dataelements/${encodedName}${writeQuery(lockHandle, params.transport_request)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: {
      Accept: ACCEPT_DATA_ELEMENT,
      'Content-Type':
        'application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8',
    },
  });
}
