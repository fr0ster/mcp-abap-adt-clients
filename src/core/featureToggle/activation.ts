/**
 * Feature Toggle activation operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { FEATURE_TOGGLE } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

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
