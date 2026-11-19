/**
 * The settings write: `PUT …/settings/{name}?lockHandle=…[&corrNr=…]`, the
 * document built from the caller's typed settings.
 */

import type {
  IAdtHeaders,
  ITableSettingsUpdateConfig,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TABLE_SETTINGS } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { updateRequestHeaders } from '../../utils/requestHeaders';
import { tableSettingsDocument } from './document';

/**
 * One PUT, under the caller's lock.
 *
 * **The whole content, every time.** This is a replace, never a merge: SAP
 * writes every setting from the document, so the caller reads, changes and
 * writes back the whole set.
 */
export async function updateTableSettings(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  ifMatch: string | undefined,
  config: ITableSettingsUpdateConfig,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TABLE_SETTINGS.uri(config.tableName)}${writeQuery(lockHandle, config.transportRequest)}`,
    method: 'PUT',
    timeout: 0,
    data: tableSettingsDocument(config),
    // `'kept'`: the guarded write keeps `; charset=utf-8`, the media type the
    // settings write was measured with (2026-11-19), unlike the other
    // documents' guarded writes (`writeObjectDocument`), which drop it.
    headers: updateRequestHeaders(headers, ifMatch, 'kept'),
  });
}
