import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

function buildActivationXml(name: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/ddic/dsfi/${encodeSapObjectName(name.toLowerCase())}" adtcore:name="${name.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

function parseActivationResponse(response: AxiosResponse): {
  success: boolean;
  message: string;
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  try {
    const result = parser.parse(response.data);
    const properties = result['chkl:messages']?.['chkl:properties'];
    if (properties) {
      const activated =
        properties.activationExecuted === 'true' ||
        properties.activationExecuted === true;
      const checked =
        properties.checkExecuted === 'true' ||
        properties.checkExecuted === true;
      return {
        success: activated && checked,
        message: activated
          ? 'Scalar function implementation activated successfully'
          : 'Activation failed',
      };
    }
    return { success: false, message: 'Unknown activation status' };
  } catch (error) {
    return {
      success: false,
      message: `Failed to parse activation response: ${error}`,
    };
  }
}

export async function activateScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/activation?method=activate&preauditRequested=true`;
  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: buildActivationXml(name),
    headers: { Accept: 'application/xml', 'Content-Type': 'application/xml' },
  });
  const activationResult = parseActivationResponse(response);
  if (!activationResult.success) {
    throw new Error(
      `Scalar function implementation activation failed: ${activationResult.message}`,
    );
  }
  return response;
}
