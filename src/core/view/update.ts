/**
 * View update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockDDLSForUpdate } from './lock';
import { unlockDDLS } from './unlock';
import { activateDDLS } from './activation';
import { UpdateViewSourceParams } from './types';

/**
 * Upload DDL source code (for update)
 */
async function uploadDDLSourceForUpdate(
  connection: AbapConnection,
  viewName: string,
  ddlSource: string,
  lockHandle: string,
  sessionId: string,
  transportRequest?: string
): Promise<AxiosResponse> {
  const queryParams = `lockHandle=${lockHandle}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, ddlSource, headers);
}

/**
 * Update view DDL source code
 * Full workflow: lock -> upload source -> unlock -> activate (optional)
 */
export async function updateViewSource(
  connection: AbapConnection,
  params: UpdateViewSourceParams
): Promise<AxiosResponse> {
  const viewName = params.view_name.toUpperCase();
  const sessionId = generateSessionId();
  let lockHandle: string | null = null;

  try {
    const lockResult = await lockDDLSForUpdate(connection, viewName, sessionId);
    lockHandle = lockResult.lockHandle;
    const corrNr = lockResult.corrNr;

    await uploadDDLSourceForUpdate(connection, viewName, params.ddl_source, lockHandle, sessionId, corrNr);

    await unlockDDLS(connection, viewName, lockHandle, sessionId);
    lockHandle = null;

    const shouldActivate = params.activate === true;

    if (shouldActivate) {
      await activateDDLS(connection, viewName, sessionId);
    }

    return {
      data: {
        success: true,
        view_name: viewName,
        type: 'DDLS/DF',
        message: shouldActivate
          ? `View ${viewName} source updated and activated successfully`
          : `View ${viewName} source updated successfully (not activated)`,
        uri: `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}`,
        source_size_bytes: params.ddl_source.length
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    if (lockHandle) {
      try {
        await unlockDDLS(connection, viewName, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }

    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to update view ${viewName}: ${errorMessage}`);
  }
}

