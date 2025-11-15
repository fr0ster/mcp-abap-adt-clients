/**
 * Structure validation
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { validateObjectName, ValidationResult } from '../shared/validation';

/**
 * Validate structure name
 */
export async function validateStructureName(
  connection: AbapConnection,
  structureName: string,
  description?: string
): Promise<ValidationResult> {
  const params: Record<string, string> = {};

  if (description) {
    params.description = description;
  }

  return validateObjectName(connection, 'STRU/DT', structureName, params);
}

