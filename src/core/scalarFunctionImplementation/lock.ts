import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function lockScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
): Promise<string> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const url = `/sap/bc/adt/ddic/dsfi/${encoded}?_action=LOCK&accessMode=MODIFY`;
  const response = await connection.makeAdtRequest({
    method: 'POST',
    url,
    headers: { Accept: ACCEPT_LOCK },
    timeout: getTimeout('default'),
  });
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const result = parser.parse(response.data);
  const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
  if (!lockHandle)
    throw new Error('Failed to extract lock handle from response');
  return lockHandle;
}
