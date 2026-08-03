/**
 * View read operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { noopLogger } from '../../utils/noopLogger';
import { getTimeout } from '../../utils/timeouts';
import { AdtUtils } from '../shared/AdtUtils';
import type { IReadOptions } from '../shared/types';

function getUtils(connection: IAbapConnection): AdtUtils {
  return new AdtUtils(connection, noopLogger);
}

/**
 * Get ABAP view metadata (without source code)
 */
export async function getDdlMetadata(
  connection: IAbapConnection,
  ddlName: string,
  options?: IReadOptions,
): Promise<IAdtResponse> {
  return getUtils(connection).readObjectMetadata(
    'view',
    ddlName,
    undefined,
    options,
  );
}

/**
 * Get ABAP view source code
 */
export async function getDdlSource(
  connection: IAbapConnection,
  ddlName: string,
  version?: 'active' | 'inactive',
  options?: IReadOptions,
): Promise<IAdtResponse> {
  return getUtils(connection).readObjectSource(
    'view',
    ddlName,
    undefined,
    version,
    options,
  );
}

/**
 * Get ABAP view (source code by default for backward compatibility)
 * @deprecated Use getDdlSource() or getDdlMetadata() instead
 */
export async function getDdl(
  connection: IAbapConnection,
  ddlName: string,
): Promise<IAdtResponse> {
  return getDdlSource(connection, ddlName);
}

/**
 * Get transport request for ABAP view
 * @param connection - SAP connection
 * @param ddlName - View name
 * @returns Transport request information
 */
export async function getDdlTransport(
  connection: IAbapConnection,
  ddlName: string,
  options?: IReadOptions,
): Promise<IAdtResponse> {
  const encodedName = encodeSapObjectName(ddlName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/ddl/sources/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
