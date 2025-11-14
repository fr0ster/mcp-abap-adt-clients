/**
 * Interface validation
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { validateObjectName, ValidationResult } from '../shared/validation';

/**
 * Validate interface name
 */
export async function validateInterfaceName(
  connection: AbapConnection,
  interfaceName: string,
  description?: string
): Promise<ValidationResult> {
  const params: Record<string, string> = {};

  if (description) {
    params.description = description;
  }

  return validateObjectName(connection, 'INTF/OI', interfaceName, params);
}
