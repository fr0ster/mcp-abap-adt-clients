/**
 * Message class update operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { MESSAGE_CLASS_UPDATE_CONTENT_TYPE } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

const BASE = '/sap/bc/adt/messageclass';

/**
 * `PUT /messageclass/{name}` with the document the caller built — one request.
 *
 * Until 23.0.0 this read the class first, patched the description into it and
 * PUT the rebuilt XML: two requests, and a document this library composed in
 * place of the caller's. The read is now the caller's (`readMetadata`, then
 * `parseMessageClass` / `buildMessageClassXml` if they want them), as for every
 * other document-shaped object here.
 *
 * NOTE: the caller holds the lock and passes its handle.
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateMessageClass(
  connection: IAbapConnection,
  name: string,
  document: string,
  lockHandle: string | undefined,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  return connection.makeAdtRequest({
    url: `${BASE}/${encoded}${writeQuery(lockHandle, transportRequest?.trim())}`,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: { 'Content-Type': MESSAGE_CLASS_UPDATE_CONTENT_TYPE },
  });
}
