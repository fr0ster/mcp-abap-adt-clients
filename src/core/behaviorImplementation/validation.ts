/**
 * Behavior Implementation validation
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse, AxiosError } from 'axios';
import { encodeSapObjectName, limitDescription } from '../../utils/internalUtils';

/**
 * Validate behavior implementation class name
 * Uses ADT validation endpoint: /sap/bc/adt/oo/validation/objectname
 * 
 * @param connection - SAP connection
 * @param className - Behavior implementation class name (e.g., ZBP_OK_I_CDS_TEST)
 * @param packageName - Package name
 * @param description - Description
 * @param behaviorDefinition - Behavior definition name (root entity)
 * @returns Validation response (returns error response if object already exists)
 */
export async function validateBehaviorImplementationName(
  connection: IAbapConnection,
  className: string,
  packageName?: string,
  description?: string,
  behaviorDefinition?: string
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(className);

  // Build query parameters for behavior implementation validation
  const params = new URLSearchParams({
    objname: encodedName,
    objtype: 'CLAS/OC'
  });

  if (packageName) {
    params.append('packagename', packageName);
  }

  if (description) {
    // Description is limited to 60 characters in SAP ADT
    params.append('description', limitDescription(description));
  }

  if (behaviorDefinition) {
    params.append('behaviorDefinition', behaviorDefinition);
  }

  const url = `/sap/bc/adt/oo/validation/objectname?${params.toString()}`;
  const headers = {
    'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.oo.clifname.check'
  };

  try {
    return await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      headers
    });
  } catch (error: any) {
    // If validation returns 400 and object already exists, return error response instead of throwing
    if (error instanceof AxiosError && error.response?.status === 400) {
      return error.response;
    }
    throw error;
  }
}

