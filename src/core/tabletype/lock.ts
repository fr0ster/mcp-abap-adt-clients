/**
 * TableType lock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Acquire lock handle for the table type by locking it for modification
 */
export async function acquireTableTypeLockHandle(
  connection: IAbapConnection,
  tableTypeName: string,
): Promise<string> {
  const url = `/sap/bc/adt/ddic/tabletypes/${encodeSapObjectName(tableTypeName)}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    Accept: ACCEPT_LOCK,
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

  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error('Failed to obtain lock handle from SAP response');
  }

  return lockHandle;
}
