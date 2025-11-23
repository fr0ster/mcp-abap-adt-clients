/**
 * View validation
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { validateObjectName, ValidationResult } from '../../utils/validation';

/**
 * Validate view name
 */
export async function validateViewName(
  connection: AbapConnection,
  viewName: string,
  description?: string
): Promise<ValidationResult> {
  const params: Record<string, string> = {};

  if (description) {
    params.description = description;
  }

  return validateObjectName(connection, 'DDLS/DF', viewName, params);
}

