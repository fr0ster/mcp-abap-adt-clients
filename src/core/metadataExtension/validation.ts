/**
 * Metadata Extension Validation
 * 
 * Validates parameters before creating a metadata extension (DDLX)
 * Uses ADT validation endpoint: /sap/bc/adt/ddic/ddlx/sources/validation
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse, AxiosError } from 'axios';
import { MetadataExtensionValidationParams } from './types';

/**
 * Validate metadata extension parameters
 * Returns raw response from ADT - consumer decides how to interpret it
 * 
 * Endpoint: POST /sap/bc/adt/ddic/ddlx/sources/validation
 * 
 * @param connection - ABAP connection instance
 * @param params - Validation parameters
 * @returns Raw AxiosResponse from ADT validation endpoint (returns error response if object already exists)
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

  try {
    return await connection.makeAdtRequest({
      url: `${url}?${queryParams.toString()}`,
      method: 'POST',
      timeout: getTimeout('default'),
      headers: {
        'Accept': 'application/vnd.sap.as+xml'
      }
    });
  } catch (error: any) {
    // If validation returns 400 and object already exists, return error response instead of throwing
    if (error instanceof AxiosError && error.response?.status === 400) {
      return error.response;
    }
    throw error;
  }
}
