/**
 * The settings read: `GET /sap/bc/adt/ddic/db/settings/{name}`.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { objectMetadataWire } from '../shared/objectWire';
import type { IReadOptions } from '../shared/types';

/**
 * The settings document, answered as it arrived. Accept is v2 unless the
 * caller names another: a v1 Accept is answered 406.
 */
export async function getTableSettings(
  connection: IAbapConnection,
  tableName: string,
  options?: IReadOptions,
): Promise<IAdtWireResponse> {
  return objectMetadataWire(
    connection,
    'TABL/DTT',
    tableName,
    undefined,
    options,
  );
}
