/**
 * Include source upload — assumes the include is already locked.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { includeUrl } from './lock';

export async function uploadIncludeSource(
  connection: IAbapConnection,
  includeName: string,
  sourceCode: string,
  lockHandle?: string,
  corrNr?: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${includeUrl(includeName)}/source/main${writeQuery(lockHandle, corrNr)}`,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: sourceCode,
    headers: { Accept: ACCEPT_SOURCE, 'Content-Type': CT_SOURCE },
  });
}
