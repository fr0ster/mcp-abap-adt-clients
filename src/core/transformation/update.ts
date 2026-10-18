import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { sourceUri, TRANSFORMATION } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IUpdateTransformationParams } from './types';

/**
 * Update transformation source code
 * Requires object to be locked first (lockHandle must be provided)
 *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateTransformation(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: IUpdateTransformationParams,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const url = `${sourceUri(TRANSFORMATION.uri(args.transformation_name.toLowerCase()))}${writeQuery(lockHandle, args.transport_request)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: args.source_code,
    headers: requestHeaders(headers),
  });
}
