/**
 * AuthorizationField (SUSO / AUTH) activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AUTHORIZATION_FIELD } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

function buildActivationXml(name: string): string {
  const upper = name.toUpperCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${AUTHORIZATION_FIELD.uri(upper)}" adtcore:name="${upper}"/>
</adtcore:objectReferences>`;
}

/**
 * Activate an authorization field.
 */
export async function activateAuthorizationField(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const xmlBody = buildActivationXml(name);

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });

  return response;
}
