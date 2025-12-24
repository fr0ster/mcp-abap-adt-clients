/**
 * Class lock operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock class for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function lockClass(
  connection: IAbapConnection,
  className: string,
): Promise<string> {
  const url = `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;

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

  // Parse lock handle from XML response
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error(
      'Failed to obtain lock handle from SAP. Class may be locked by another user.',
    );
  }

  return lockHandle;
}

/**
 * Lock class for editing (for update)
 * Returns lock handle and transport number
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function lockClassForUpdate(
  connection: IAbapConnection,
  className: string,
): Promise<{ response: AxiosResponse; lockHandle: string; corrNr?: string }> {
  const url = `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;

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

  // Parse lock handle and transport number from XML response
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
  });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
  const corrNr = result?.['asx:abap']?.['asx:values']?.DATA?.CORRNR;

  if (!lockHandle) {
    throw new Error(
      'Failed to obtain lock handle from SAP. Class may be locked by another user.',
    );
  }

  return { response, lockHandle, corrNr };
}
