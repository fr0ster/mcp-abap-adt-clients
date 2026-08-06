import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { assertActivationSucceeded } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

function buildActivationXml(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/dsfi/${encodeSapObjectName(name.toLowerCase())}" adtcore:name="${name.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

export async function activateScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: buildActivationXml(name),
    headers: { Accept: 'application/xml', 'Content-Type': 'application/xml' },
  });
  assertActivationSucceeded('Scalar function implementation', response.data);
  return response;
}
