/**
 * Feature Toggle activation operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
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
          ? 'Feature toggle activated successfully'
          : 'Activation failed',
      };
    }

    // When the response body is empty, SAP treats activation as successful.
    return { success: true, message: 'Feature toggle activated' };
  } catch (error) {
    return {
      success: false,
      message: `Failed to parse activation response: ${error}`,
    };
  }
}

/**
 * Activate a feature toggle.
 */
export async function activateFeatureToggle(
  connection: IAbapConnection,
  name: string,
): Promise<AxiosResponse> {
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

  const activationResult = parseActivationResponse(response);
  if (!activationResult.success) {
    throw new Error(
      `Feature toggle activation failed: ${activationResult.message}`,
    );
  }

  return response;
}
