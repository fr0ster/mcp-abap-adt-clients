/**
 * Lock Metadata Extension (DDLX) for editing
 *
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/{name}?_action=LOCK&accessMode=MODIFY
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { METADATA_EXTENSION } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` — answered as it arrived.
 *
 * The handle is read by `lockHandleOf` in the member. Until 23.0.0 this parsed
 * it and threw when SAP's answer had none, which turned a statement about SAP's
 * answer into a library failure and dropped the answer.
 */
export async function lockMetadataExtension(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    method: 'POST',
    url: `${METADATA_EXTENSION.uri(name)}?_action=LOCK&accessMode=MODIFY`,
    timeout: getTimeout('default'),
    data: undefined,
    headers: { Accept: ACCEPT_LOCK },
  });
}
