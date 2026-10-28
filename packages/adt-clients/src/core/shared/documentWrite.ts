/**
 * An object's metadata document, written as the caller built it.
 *
 * `PUT <object>?lockHandle=…[&corrNr=…]`, the body the caller's document as
 * it is and the headers the caller's: one request. Nothing is read first,
 * nothing is merged into the document and nothing is locked here — the
 * caller holds the lock and passes its handle.
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds (`readMetadata`), change what you mean to change, and
 * pass the result: anything left out is gone, because nothing is read here to
 * keep it.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';

export async function writeObjectDocument(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  objectUri: string,
  document: string,
  lockHandle: string | undefined,
  transportRequest: string | undefined,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${objectUri}${writeQuery(lockHandle, transportRequest)}`,
    method: 'PUT',
    timeout: 0,
    data: document,
    headers: requestHeaders(headers),
  });
}
