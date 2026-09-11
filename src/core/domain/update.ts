/**
 * Domain update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields that would be lost if XML were built from scratch.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_DOMAIN } from '../../constants/contentTypes';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateDomainParams } from './types';

/**
 * Write the document the caller built.
 *
 * **One request.** This used to GET the current document, patch the fields
 * named in `params` into it, and PUT the result — two requests in one member,
 * and a merge whose rules nobody outside could change. A caller reads the
 * document with the member that reads it, edits it, and passes it here, which
 * is also where the guarantee that it is valid belongs.
 *
 * So `params` carries what the *request* needs — the name, the transport — and
 * nothing that used to be merged into the body. A field left out of `document`
 * is not preserved: nothing was read to preserve it from.
 */
export async function updateDomain(
  connection: IAbapConnection,
  args: IUpdateDomainParams,
  document: string,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const domainNameEncoded = encodeSapObjectName(args.domain_name.toLowerCase());
  const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}${writeQuery(lockHandle, args.transport_request)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: {
      Accept: ACCEPT_DOMAIN,
      'Content-Type': 'application/vnd.sap.adt.domains.v2+xml; charset=utf-8',
    },
  });
}
