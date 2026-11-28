/**
 * Type group source write: one `PUT` of the source under the caller's lock.
 *
 * **The whole content, every time.** This is a replace, never a merge: the
 * source sent is the type group's whole source.
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { sourceUri, TYPE_GROUP } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { updateRequestHeaders } from '../../utils/requestHeaders';
import type { IUpdateTypeGroupParams } from './types';

export async function updateTypeGroup(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  ifMatch: string | undefined,
  args: IUpdateTypeGroupParams,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${sourceUri(TYPE_GROUP.uri(args.type_group_name))}${writeQuery(lockHandle, args.transport_request)}`,
    method: 'PUT',
    timeout: 0,
    data: args.source_code,
    headers: updateRequestHeaders(headers, ifMatch, 'kept'),
  });
}
