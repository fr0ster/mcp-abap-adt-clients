/**
 * Metadata Extension Validation
 * 
 * Validates parameters before creating a metadata extension (DDLX)
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/ddlx/sources/validation
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { MetadataExtensionValidationParams } from './types';

/**
 * Validate metadata extension parameters
 * Returns raw response from ADT - consumer decides how to interpret it
 * 
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/validation
 * 
 * @param connection - ABAP connection instance
 * @param params - Validation parameters
 * @returns Raw AxiosResponse from ADT validation endpoint
 * 
 * Response format:
 * - Success: <CHECK_RESULT>X</CHECK_RESULT>
 * - Error: <exc:exception> with message about existing object or validation failure
 */
export async function validateMetadataExtension(
  connection: AbapConnection,
  params: MetadataExtensionValidationParams
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/ddlx/sources/validation`;
  const queryParams = new URLSearchParams({
    objtype: 'ddlxex',
    objname: params.name,
    description: params.description || params.name,
    packagename: params.packageName
  });

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.as+xml'
    }
  });
}
