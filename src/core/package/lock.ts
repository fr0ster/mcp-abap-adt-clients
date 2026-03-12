/**
 * Package lock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock package for modification
 * Returns lock handle that must be used in subsequent requests
 *
 * NOTE: Caller must enable stateful session mode via connection.setSessionType("stateful")
 * before calling this function
 */
export interface IPackageLockResult {
  lockHandle: string;
  corrNr?: string;
}

export async function lockPackage(
  connection: IAbapConnection,
  packageName: string,
): Promise<IPackageLockResult> {
  const url = `/sap/bc/adt/packages/${encodeSapObjectName(packageName.toLowerCase())}?_action=LOCK&accessMode=MODIFY`;

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

  // Parse lock handle from XML response
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const result = parser.parse(response.data);
  const data = result?.['asx:abap']?.['asx:values']?.DATA;
  const lockHandle = data?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error(
      'Failed to obtain lock handle from SAP. Package may be locked by another user.',
    );
  }

  const corrNr = data?.CORR_NUMBER || undefined;
  return { lockHandle, corrNr };
}
