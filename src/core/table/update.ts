/**
 * Table update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { acquireTableLockHandle } from './lock';
import { unlockTable } from './unlock';
import { activateTable } from './activation';

export interface UpdateTableParams {
  table_name: string;
  ddl_code: string;
  transport_request?: string;
  activate?: boolean;
}

/**
 * Update table DDL source code
 * Full workflow: lock -> upload source -> unlock -> activate (optional)
 */
export async function updateTable(
  connection: AbapConnection,
  params: UpdateTableParams
): Promise<AxiosResponse> {
  if (!params.table_name) {
    throw new Error('table_name is required');
  }
  if (!params.ddl_code) {
    throw new Error('ddl_code is required');
  }

  const tableName = params.table_name.toUpperCase();
  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    // Step 1: Lock the table
    lockHandle = await acquireTableLockHandle(connection, tableName, sessionId);

    // Step 2: Upload new DDL code using internal logic
    await updateTableInternal(connection, params, lockHandle, sessionId);

    // Step 3: Unlock the table
    await unlockTable(connection, tableName, lockHandle, sessionId);
    lockHandle = null;

    // Step 4: Activate the table (optional)
    const shouldActivate = params.activate === true;

    if (shouldActivate) {
      await activateTable(connection, tableName, sessionId);
    }

    return {
      data: {
        success: true,
        table_name: tableName,
        type: 'TABL/DT',
        message: shouldActivate
          ? `Table ${tableName} source updated and activated successfully`
          : `Table ${tableName} source updated successfully (not activated)`,
        uri: `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName).toLowerCase()}`,
        source_size_bytes: params.ddl_code.length
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    // CRITICAL: Always try to unlock on error to prevent locked objects
    if (lockHandle) {
      try {
        await unlockTable(connection, tableName, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to update table ${tableName}: ${errorMessage}`);
  }
}

/**
 * Internal helper to update table using existing lock/session
 */
export async function updateTableInternal(
  connection: AbapConnection,
  params: UpdateTableParams,
  lockHandle: string,
  sessionId: string
): Promise<AxiosResponse> {
  if (!params.table_name) {
    throw new Error('table_name is required');
  }
  if (!params.ddl_code) {
    throw new Error('ddl_code is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  const tableName = params.table_name.toUpperCase();
  const queryParams = `lockHandle=${lockHandle}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;
  const url = `/sap/bc/adt/ddic/tables/${encodeSapObjectName(tableName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, params.ddl_code, headers);
}

