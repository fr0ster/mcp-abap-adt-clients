/**
 * AuthorizationField (SUSO / AUTH) activation operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
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
          ? 'Authorization field activated successfully'
          : 'Activation failed',
      };
    }

    // When the response body is empty, SAP treats activation as successful.
    return { success: true, message: 'Authorization field activated' };
  } catch (error) {
    return {
      success: false,
      message: `Failed to parse activation response: ${error}`,
    };
  }
}

/**
 * Activate an authorization field.
 */
export async function activateAuthorizationField(
  connection: IAbapConnection,
  name: string,
): Promise<AxiosResponse> {
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

  const activationResult = parseActivationResponse(response);
  if (!activationResult.success) {
    throw new Error(
      `Authorization field activation failed: ${activationResult.message}`,
    );
  }

  return response;
}
