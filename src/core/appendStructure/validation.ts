import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

export async function validateAppendStructureName(
  connection: IAbapConnection,
  name: string,
  description?: string,
): Promise<AxiosResponse> {
  const queryParams = new URLSearchParams({ objtype: 'tablds', objname: name });
  if (description) queryParams.append('description', description);
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/ddic/structures/validation?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: { Accept: ACCEPT_VALIDATION },
  });
}
