/**
 * Type group delete: one `DELETE` on its own address under the caller's lock,
 * as measured (`200`, then the read answers `404`).
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_GROUP } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IDeleteTypeGroupParams } from './types';

export async function deleteTypeGroup(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: IDeleteTypeGroupParams,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TYPE_GROUP.uri(args.type_group_name)}${writeQuery(lockHandle, args.transport_request)}`,
    method: 'DELETE',
    timeout: 0,
    headers: requestHeaders(headers),
  });
}
