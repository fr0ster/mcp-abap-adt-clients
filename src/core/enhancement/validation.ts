/**
 * Enhancement validation operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import {
  ENHANCEMENT_TYPE_CODES,
  type EnhancementType,
  getEnhancementBaseUrl,
  type IValidateEnhancementParams,
} from './types';

/**
 * Validate enhancement name
 * Uses ADT validation endpoint: /sap/bc/adt/enhancements/{type}/validation
 *
 * Returns raw response from ADT - consumer decides how to interpret it
 *
 * @param connection - SAP connection
 * @param params - Validation parameters
 * @returns Axios response with validation result
 */
export async function validateEnhancementName(
  connection: IAbapConnection,
  params: IValidateEnhancementParams,
): Promise<AxiosResponse> {
  const { enhancement_name, enhancement_type, package_name, description } =
    params;

  if (!enhancement_name) {
    throw new Error('enhancement_name is required');
  }
  if (!enhancement_type) {
    throw new Error('enhancement_type is required');
  }

  const encodedName = encodeSapObjectName(enhancement_name);
  const typeCode = ENHANCEMENT_TYPE_CODES[enhancement_type];

  // Build query parameters for validation
  const queryParams = new URLSearchParams({
    objname: encodedName,
    objtype: typeCode,
  });

  if (package_name) {
    queryParams.append('packagename', package_name);
  }

  if (description) {
    queryParams.append('description', description);
  }

  const url = `${getEnhancementBaseUrl(enhancement_type)}/validation?${queryParams.toString()}`;

  const headers = {
    Accept:
      'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.validation.objectname',
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    headers,
  });
}

/**
 * Convenience function: Validate enhancement name with simpler signature
 *
 * @param connection - SAP connection
 * @param enhancementType - Enhancement type
 * @param enhancementName - Enhancement name
 * @param packageName - Optional package name
 * @param description - Optional description
 * @returns Axios response
 */
export async function validate(
  connection: IAbapConnection,
  enhancementType: EnhancementType,
  enhancementName: string,
  packageName?: string,
  description?: string,
): Promise<AxiosResponse> {
  return validateEnhancementName(connection, {
    enhancement_name: enhancementName,
    enhancement_type: enhancementType,
    package_name: packageName,
    description,
  });
}
