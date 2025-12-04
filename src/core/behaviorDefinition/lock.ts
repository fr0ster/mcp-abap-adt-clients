/**
 * Behavior Definition lock operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';

/**
 * Lock behavior definition for modification
 * 
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions/{name}?_action=LOCK&accessMode=MODIFY
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param accessMode - Access mode (default: MODIFY)
 * @returns Lock handle that must be used in subsequent update/unlock requests
 * 
 * @example
 * ```typescript
 * const lockHandle = await lock(connection, 'Z_MY_BDEF', sessionId);
 * // Use lockHandle for update operations
 * ```
 */
export async function lock(
    connection: IAbapConnection,
    name: string,
    accessMode: string = 'MODIFY'
): Promise<string> {
    const url = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}?_action=LOCK&accessMode=${accessMode}`;

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
    <DATA>
      <LOCK_HANDLE/>
      <CORRNR/>
      <CORRUSER/>
      <CORRTEXT/>
      <IS_LOCAL>X</IS_LOCAL>
      <IS_LINK_UP/>
      <MODIFICATION_SUPPORT/>
      <SCOPE_MESSAGES/>
    </DATA>
  </asx:values>
</asx:abap>`;

    const headers = {
        'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
    };

    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: getTimeout('default'),
        data: xmlBody,
        headers
    });

    // Parse lock handle from XML response
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const result = parser.parse(response.data);
    const lockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];

    if (!lockHandle) {
        throw new Error(
            `Failed to obtain lock handle for behavior definition ${name}. Object may be locked by another user.`
        );
    }

    return lockHandle;
}

/**
 * Lock behavior definition for editing (returns full response)
 * 
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param accessMode - Access mode (default: MODIFY)
 * @returns Object containing response, lockHandle, and optional transport number
 * 
 * @example
 * ```typescript
 * const { response, lockHandle, corrNr } = await lockForUpdate(connection, 'Z_MY_BDEF', sessionId);
 * ```
 */
export async function lockForUpdate(
    connection: IAbapConnection,
    name: string,
    sessionId: string,
    accessMode: string = 'MODIFY'
): Promise<{ response: AxiosResponse; lockHandle: string; corrNr?: string }> {
    const url = `/sap/bc/adt/bo/behaviordefinitions/${name.toLowerCase()}?_action=LOCK&accessMode=${accessMode}`;

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
    <DATA>
      <LOCK_HANDLE/>
      <CORRNR/>
      <CORRUSER/>
      <CORRTEXT/>
      <IS_LOCAL>X</IS_LOCAL>
      <IS_LINK_UP/>
      <MODIFICATION_SUPPORT/>
      <SCOPE_MESSAGES/>
    </DATA>
  </asx:values>
</asx:abap>`;

    const headers = {
        'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result;q=0.8, application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.result2;q=0.9'
    };

    const response = await connection.makeAdtRequest({
        url,
        method: 'POST',
        timeout: getTimeout('default'),
        data: xmlBody,
        headers
    });

    // Parse lock handle and transport number from XML response
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const result = parser.parse(response.data);
    const lockHandle = result?.['asx:abap']?.['asx:values']?.['DATA']?.['LOCK_HANDLE'];
    const corrNr = result?.['asx:abap']?.['asx:values']?.['DATA']?.['CORRNR'];

    if (!lockHandle) {
        throw new Error(
            `Failed to obtain lock handle for behavior definition ${name}. Object may be locked by another user.`
        );
    }

    return { response, lockHandle, corrNr };
}
