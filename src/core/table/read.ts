/**
 * Table read operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_TRANSPORT } from '../../constants/contentTypes';
import { orThrow } from '../../utils/adtResponse';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { noopLogger } from '../../utils/noopLogger';
import { getTimeout } from '../../utils/timeouts';
import { AdtUtils } from '../shared/AdtUtils';
import type { IReadOptions } from '../shared/types';

function getUtils(connection: IAbapConnection): AdtUtils {
  return new AdtUtils(connection, noopLogger);
}

/**
 * Get ABAP table metadata (without source code)
 */
export async function getTableMetadata(
  connection: IAbapConnection,
  tableName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return orThrow(
    getUtils(connection).readObjectMetadata(
      'table',
      tableName,
      undefined,
      options,
    ),
  );
}

/**
 * Get ABAP table source code (DDL)
 */
export async function getTableSource(
  connection: IAbapConnection,
  tableName: string,
  version?: 'active' | 'inactive',
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return orThrow(
    getUtils(connection).readObjectSource(
      'table',
      tableName,
      undefined,
      version,
      options,
    ),
  );
}

/**
 * Get ABAP table (source code by default for backward compatibility)
 * @deprecated Use getTableSource() or getTableMetadata() instead
 */
export async function getTable(
  connection: IAbapConnection,
  tableName: string,
): Promise<IAdtWireResponse> {
  return getTableSource(connection, tableName);
}

/**
 * Get transport request for ABAP table
 * @param connection - SAP connection
 * @param tableName - Table name
 * @returns Transport request information
 */
export async function getTableTransport(
  connection: IAbapConnection,
  tableName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(tableName);
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/ddic/tables/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
