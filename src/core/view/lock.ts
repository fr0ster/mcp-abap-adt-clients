/**
 * View lock operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';

/**
 * Lock DDLS for modification
 */
export async function lockDDLS(
  connection: AbapConnection,
  viewName: string,
  sessionId: string
): Promise<string> {
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  const response = await makeAdtRequestWithSession(connection, url, 'POST', sessionId, null, headers);

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];

  if (!lockHandle) {
    throw new Error('Failed to obtain lock handle from SAP');
  }

  return lockHandle;
}

/**
 * Lock DDLS for editing (for update)
 */
export async function lockDDLSForUpdate(
  connection: AbapConnection,
  viewName: string,
  sessionId: string
): Promise<{ response: AxiosResponse; lockHandle: string; corrNr?: string }> {
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
  };

  const response = await makeAdtRequestWithSession(connection, url, 'POST', sessionId, null, headers);

  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];
  const corrNr = result?.['asx:abap']?.['asx:values']?.['DATA']?.['CORRNR'];

  if (!lockHandle) {
    throw new Error('Failed to obtain lock handle from SAP. View may be locked by another user.');
  }

  return { response, lockHandle, corrNr };
}

