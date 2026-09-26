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
 * answer into a library failure and dropped the answer. `lockDDLSForUpdate`,
 * which also extracted CORRNR and had no caller, is gone.
 */
export async function lockDDLS(
  connection: IAbapConnection,
  ddlName: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/ddic/ddl/sources/${encodeSapObjectName(ddlName).toLowerCase()}?_action=LOCK&accessMode=MODIFY`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers: { Accept: ACCEPT_LOCK },
  });
}
