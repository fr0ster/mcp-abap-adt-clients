/**
 * ServiceDefinition lock operations
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock service definition for modification
 * Returns lock handle that must be used in subsequent requests
 */
export async function lockServiceDefinition(
  connection: IAbapConnection,
  serviceDefinitionName: string,
): Promise<string> {
  const serviceDefinitionNameEncoded = encodeSapObjectName(
    serviceDefinitionName.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/srvd/sources/${serviceDefinitionNameEncoded}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    Accept:
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9',
  };

  const response = await connection.makeAdtRequest({
    method: 'POST',
    url,
    headers,
    timeout: getTimeout('default'),
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const result = parser.parse(response.data);
  const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error('Failed to extract lock handle from response');
  }

  return lockHandle;
}
