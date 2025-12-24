/**
 * Interface lock operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock interface for modification
 * Returns lock handle and transport number
 */
export async function lockInterface(
  connection: IAbapConnection,
  interfaceName: string,
): Promise<{ lockHandle: string; corrNr?: string }> {
  const url = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    Accept:
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9',
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers,
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const lockData = parser.parse(response.data);

  const lockHandle = lockData['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
  const corrNr = lockData['asx:abap']?.['asx:values']?.DATA?.CORRNR;

  if (!lockHandle) {
    throw new Error('Failed to acquire lock handle from response');
  }

  return { lockHandle, corrNr };
}

/**
 * Lock interface for editing (for update)
 * Returns lock handle and transport number
 */
export async function lockInterfaceForUpdate(
  connection: IAbapConnection,
  interfaceName: string,
  _sessionId: string,
): Promise<{ response: AxiosResponse; lockHandle: string; corrNr?: string }> {
  const url = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    Accept:
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9',
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers,
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
  const corrNr = result?.['asx:abap']?.['asx:values']?.DATA?.CORRNR;

  if (!lockHandle) {
    throw new Error(
      'Failed to obtain lock handle from SAP. Interface may be locked by another user.',
    );
  }

  return { response, lockHandle, corrNr };
}
