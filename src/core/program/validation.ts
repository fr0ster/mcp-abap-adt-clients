/**
 * Program validation
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { validateObjectName, ValidationResult } from '../../utils/validation';

/**
 * Validate program name
 */
export async function validateProgramName(
  connection: AbapConnection,
  programName: string,
  description?: string
): Promise<ValidationResult> {
  const params: Record<string, string> = {};

  if (description) {
    params.description = description;
  }

  return validateObjectName(connection, 'PROG/P', programName, params);
}
