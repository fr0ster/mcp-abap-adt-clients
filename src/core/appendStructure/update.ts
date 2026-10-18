import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { STRUCTURE, sourceUri } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IUpdateAppendStructureParams } from './types';

/** *
 * **The whole content, every time.** This is a replace, never a merge. Read
 * what the object holds, change what you mean to change, and pass the result:
 * anything left out is gone, because nothing is read here to keep it.
 */
export async function updateAppendStructure(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  args: IUpdateAppendStructureParams,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const corrNrParam = args.transport_request
    ? `&corrNr=${encodeURIComponent(args.transport_request)}`
    : '';
  const url = `${sourceUri(STRUCTURE.uri(args.append_structure_name))}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;
  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: args.source_code,
    headers: requestHeaders(headers),
  });
}
