/**
 * Function Group validation
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { validateObjectName, ValidationResult } from '../../utils/validation';

/**
 * Validate function group name
 */
export async function validateFunctionGroupName(
  connection: AbapConnection,
  functionGroupName: string,
  description?: string
): Promise<ValidationResult> {
  const params: Record<string, string> = {};

  if (description) {
    params.description = description;
  }

  return validateObjectName(connection, 'FUGR/F', functionGroupName, params);
}
