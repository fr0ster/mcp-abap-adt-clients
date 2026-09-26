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
import { encodeSapObjectName } from '../../utils/internalUtils';
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
  const lowerName = encodeSapObjectName(name).toLowerCase();
  return connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/ddic/ddlx/sources/${lowerName}?_action=LOCK&accessMode=MODIFY`,
    timeout: getTimeout('default'),
    data: undefined,
    headers: { Accept: ACCEPT_LOCK },
  });
}
