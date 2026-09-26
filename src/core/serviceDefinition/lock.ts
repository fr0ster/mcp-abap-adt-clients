/**
 * ServiceDefinition lock operations
 * NOTE: Caller should call connection.setSessionType("stateful") before locking
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
export async function lockServiceDefinition(
  connection: IAbapConnection,
  serviceDefinitionName: string,
): Promise<IAdtWireResponse> {
  const serviceDefinitionNameEncoded = encodeSapObjectName(
    serviceDefinitionName.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/srvd/sources/${serviceDefinitionNameEncoded}?_action=LOCK&accessMode=MODIFY`;

  return connection.makeAdtRequest({
    method: 'POST',
    url,
    headers: { Accept: ACCEPT_LOCK },
    timeout: getTimeout('default'),
  });
}
