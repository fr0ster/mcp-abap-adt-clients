import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { SCALAR_FUNCTION_IMPLEMENTATION } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';

function buildActivationXml(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${SCALAR_FUNCTION_IMPLEMENTATION.uri(name)}" adtcore:name="${name.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

export async function activateScalarFunctionImplementation(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
): Promise<IAdtWireResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: buildActivationXml(name),
    headers: requestHeaders(headers),
  });
  return response;
}
