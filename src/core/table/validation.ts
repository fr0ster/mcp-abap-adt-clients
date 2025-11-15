/**
 * Table validation
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { validateObjectName, ValidationResult } from '../shared/validation';

/**
 * Validate table name
 */
export async function validateTableName(
  connection: AbapConnection,
  tableName: string,
  description?: string
): Promise<ValidationResult> {
  const params: Record<string, string> = {};

  if (description) {
    params.description = description;
  }

  return validateObjectName(connection, 'TABL/DT', tableName, params);
}

