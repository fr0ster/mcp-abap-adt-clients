/**
 * Enhancement lock operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { type EnhancementType, getEnhancementUri } from './types';

/**
 * Lock enhancement for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type (enhoxh, enhoxhb, enhoxhh, enhsxs, enhsxsb)
 * @param enhancementName - Enhancement name
 * @returns Lock handle string
 */
export async function lockEnhancement(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
): Promise<string> {
  const encodedName = encodeSapObjectName(enhancementName).toLowerCase();
  const url = `${getEnhancementUri(enhancementType, encodedName)}?_action=LOCK&accessMode=MODIFY`;

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
      `Failed to obtain lock handle for enhancement ${enhancementName}. Object may be locked by another user.`,
    );
  }

  return lockHandle;
}

/**
 * Lock enhancement for editing (for update)
 * Returns lock handle and transport number
 *
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @returns Object containing response, lockHandle, and optional corrNr
 */
export async function lockEnhancementForUpdate(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
): Promise<{ response: AxiosResponse; lockHandle: string; corrNr?: string }> {
  const encodedName = encodeSapObjectName(enhancementName).toLowerCase();
  const url = `${getEnhancementUri(enhancementType, encodedName)}?_action=LOCK&accessMode=MODIFY`;

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
      `Failed to obtain lock handle for enhancement ${enhancementName}. Object may be locked by another user.`,
    );
  }

  return { response, lockHandle, corrNr };
}
