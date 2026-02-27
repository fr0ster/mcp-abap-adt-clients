import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Build activation XML payload
 */
function buildActivationXml(accessControlName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/acm/dcl/sources/${encodeSapObjectName(accessControlName.toLowerCase())}" adtcore:name="${accessControlName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

/**
 * Parse activation response
 */
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
          ? 'Access control activated successfully'
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

/**
 * Activate access control
 */
export async function activateAccessControl(
  connection: IAbapConnection,
  accessControlName: string,
): Promise<AxiosResponse> {
  const url = '/sap/bc/adt/activation?method=activate&preauditRequested=true';
  const xmlBody = buildActivationXml(accessControlName);

  const headers = {
    Accept: 'application/xml',
    'Content-Type': 'application/xml',
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });

  const activationResult = parseActivationResponse(response);
  if (!activationResult.success) {
    throw new Error(
      `Access control activation failed: ${activationResult.message}`,
    );
  }

  return response;
}
