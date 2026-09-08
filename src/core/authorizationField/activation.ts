/**
 * AuthorizationField (SUSO / AUTH) activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

function buildActivationXml(name: string): string {
  const upper = name.toUpperCase();
  const encoded = encodeSapObjectName(upper);
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/aps/iam/auth/${encoded}" adtcore:name="${upper}"/>
</adtcore:objectReferences>`;
}

/**
 * Activate an authorization field.
 */
export async function activateAuthorizationField(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  if (!name) {
    throw new Error('Authorization field name is required');
  }

  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const xmlBody = buildActivationXml(name);

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept: 'application/xml',
      'Content-Type': 'application/xml',
    },
  });

  return response;
}
