/**
 * Feature Toggle activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FEATURE_TOGGLE } from '../../endpoints/objects';
import { getTimeout } from '../../utils/timeouts';

function buildActivationXml(name: string): string {
  const lower = name.toLowerCase();
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${FEATURE_TOGGLE.uri(lower)}" adtcore:name="${name.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

/**
 * Activate a feature toggle.
 */
export async function activateFeatureToggle(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
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
