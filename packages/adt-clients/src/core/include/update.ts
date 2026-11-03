/**
 * Include source upload — assumes the include is already locked.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { writeQuery } from '../../utils/internalUtils';
import { updateRequestHeaders } from '../../utils/requestHeaders';
import { includeUrl } from './lock';

export async function uploadIncludeSource(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  ifMatch: string | undefined,
  includeName: string,
  sourceCode: string,
  lockHandle?: string,
  corrNr?: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${includeUrl(includeName)}/source/main${writeQuery(lockHandle, corrNr)}`,
    method: 'PUT',
    timeout: 0,
    data: sourceCode,
    headers: updateRequestHeaders(headers, ifMatch, 'kept'),
  });
}
