/**
 * View update operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '@mcp-abap-adt/connection';
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
  transportRequest?: string
): Promise<AxiosResponse> {
  const queryParams = `lockHandle=${lockHandle}${transportRequest ? `&corrNr=${transportRequest}` : ''}`;
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(viewName).toLowerCase()}/source/main?${queryParams}`;

  const headers = {
    'Content-Type': 'text/plain; charset=utf-8'
  };

  return connection.makeAdtRequest({ url, method: 'PUT', timeout: getTimeout(), data: ddlSource, headers });
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
  const reuseLock = Boolean(params.lock_handle);
  let lockHandle: string | null = params.lock_handle || null;
  let corrNr: string | undefined = params.transport_request;

  try {
    if (!reuseLock) {
      const lockResult = await lockDDLSForUpdate(connection, viewName);
      lockHandle = lockResult.lockHandle;
      corrNr = lockResult.corrNr ?? corrNr;
    }

    if (!lockHandle) {
      throw new Error('lock_handle is required for updateViewSource');
    }

    await uploadDDLSourceForUpdate(connection, viewName, params.ddl_source, lockHandle, corrNr);

    if (!reuseLock) {
      await unlockDDLS(connection, viewName, lockHandle);
      lockHandle = null;
    }

    const shouldActivate = params.activate === true;

    if (shouldActivate) {
      await activateDDLS(connection, viewName);
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
    if (!reuseLock && lockHandle) {
      try {
        await unlockDDLS(connection, viewName, lockHandle);
      } catch {
        // Ignore unlock errors for auto-managed locks
      }
    }

    const baseError = error instanceof Error ? error : new Error(String(error));
    if ((error as any)?.response && !(baseError as any).response) {
      (baseError as any).response = (error as any).response;
    }
    if ((error as any)?.status && !(baseError as any).status) {
      (baseError as any).status = (error as any).status;
    }
    if ((error as any)?.config && !(baseError as any).config) {
      (baseError as any).config = (error as any).config;
    }

    throw baseError;
  }
}

