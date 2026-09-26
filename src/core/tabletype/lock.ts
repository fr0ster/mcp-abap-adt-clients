/**
 * TableType lock operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * `POST …?_action=LOCK` — answered as it arrived. The handle is read by
 * `lockHandleOf` in the member; until 23.0.0 this parsed it and threw when
 * SAP's answer had none, which dropped the answer.
 */
export async function lockTableType(
  connection: IAbapConnection,
  tableTypeName: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/ddic/tabletypes/${encodeSapObjectName(tableTypeName)}?_action=LOCK&accessMode=MODIFY`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}
