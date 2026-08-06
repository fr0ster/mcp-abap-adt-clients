/**
 * Feature Toggle activation operations
 */

import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { assertActivationSucceeded } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

function buildActivationXml(name: string): string {
  const lower = name.toLowerCase();
  const encoded = encodeSapObjectName(lower);
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/sfw/featuretoggles/${encoded}" adtcore:name="${name.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

/**
 * Activate a feature toggle.
 */
export async function activateFeatureToggle(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtResponse> {
  if (!name) {
    throw new Error('Feature toggle name is required');
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

  assertActivationSucceeded('Feature toggle', response.data);

  return response;
}
