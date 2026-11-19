/**
 * The settings write: `PUT …/settings/{name}?lockHandle=…[&corrNr=…]`, the
 * document built from the caller's typed settings.
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TABLE_SETTINGS } from '../../endpoints/objects';
import { writeQuery } from '../../utils/internalUtils';
import { updateRequestHeaders } from '../../utils/requestHeaders';
import {
  type ITableSettingsDocumentInput,
  tableSettingsDocument,
} from './document';

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
  config: ITableSettingsDocumentInput & {
    readonly transportRequest?: string | undefined;
  },
  lockHandle: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `${TABLE_SETTINGS.uri(config.tableName)}${writeQuery(lockHandle, config.transportRequest)}`,
    method: 'PUT',
    timeout: 0,
    data: tableSettingsDocument(config),
    // `'dropped'`, as every document's guarded write: the settings' ETag
    // carries the media type without the charset, so a PUT with `If-Match`
    // and `; charset=utf-8` is refused 412 SADT_RESOURCE/043 and one without
    // it accepted; without `If-Match` the charset is sent as given (measured
    // on premise and on the cloud, 2026-11-19).
    headers: updateRequestHeaders(headers, ifMatch, 'dropped'),
  });
}
