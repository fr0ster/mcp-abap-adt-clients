/**
 * FunctionModule lock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Lock function module for editing
 */
export async function lockFunctionModule(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
): Promise<string> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModuleName = encodeSapObjectName(functionModuleName).toLowerCase();
  const url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  const lockData = parser.parse(response.data);
  const lockHandle = lockData['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error('Failed to acquire lock handle from response');
  }

  return lockHandle;
}

/**
 * Lock function module for editing (for update)
 */
export async function lockFunctionModuleForUpdate(
  connection: IAbapConnection,
  functionGroupName: string,
  functionModuleName: string,
  sessionId: string
): Promise<{ response: AxiosResponse; lockHandle: string; corrNr?: string }> {
  const encodedGroupName = encodeSapObjectName(functionGroupName).toLowerCase();
  const encodedModuleName = encodeSapObjectName(functionModuleName).toLowerCase();
  const url = `/sap/bc/adt/functions/groups/${encodedGroupName}/fmodules/${encodedModuleName}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers
  });

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];
  const corrNr = result?.['asx:abap']?.['asx:values']?.['DATA']?.['CORRNR'];

  if (!lockHandle) {
    throw new Error('Failed to obtain lock handle from SAP. Function module may be locked by another user.');
  }

  return { response, lockHandle, corrNr };
}

