/**
 * Behavior Definition lock operations
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
export async function lock(
  connection: IAbapConnection,
  name: string,
  accessMode: string = 'MODIFY',
): Promise<IAdtWireResponse> {
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
    <DATA>
      <LOCK_HANDLE/>
      <CORRNR/>
      <CORRUSER/>
      <CORRTEXT/>
      <IS_LOCAL>X</IS_LOCAL>
      <IS_LINK_UP/>
      <MODIFICATION_SUPPORT/>
      <SCOPE_MESSAGES/>
    </DATA>
  </asx:values>
</asx:abap>`;

  return connection.makeAdtRequest({
    url: `/sap/bc/adt/bo/behaviordefinitions/${encodeSapObjectName(name).toLowerCase()}?_action=LOCK&accessMode=${accessMode}`,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: ACCEPT_LOCK,
      'Content-Type': 'application/xml',
    },
  });
}
