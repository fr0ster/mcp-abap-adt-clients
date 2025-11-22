/**
 * Table lock operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Acquire lock handle for the table by locking it for modification
 */
export async function acquireTableLockHandle(
  connection: AbapConnection,
  tableName: string,
): Promise<string> {
  const url = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName)}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];

  if (!lockHandle) {
    throw new Error('Failed to obtain lock handle from SAP response');
  }

  return lockHandle;
}

