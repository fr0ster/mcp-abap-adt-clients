/**
 * Behavior Implementation validation
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { AxiosError } from 'axios';
import { ACCEPT_VALIDATION_CLASS_NAME } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

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
  behaviorDefinition?: string,
): Promise<AxiosResponse> {
  // Build query parameters for behavior implementation validation
  const params = new URLSearchParams({
    objname: className,
    objtype: 'CLAS/OC',
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
    Accept: ACCEPT_VALIDATION_CLASS_NAME,
  };

  try {
    return await connection.makeAdtRequest({
      url,
      method: 'POST',
      timeout: getTimeout('default'),
      headers,
    });
  } catch (error: any) {
    // If validation returns 400 and object already exists, return error response instead of throwing
    if (error instanceof AxiosError && error.response?.status === 400) {
      return error.response;
    }
    throw error;
  }
}
