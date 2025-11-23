/**
 * Metadata Extension Validation
 * 
 * Validates parameters before creating a metadata extension (DDLX)
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { MetadataExtensionValidationParams } from './types';

/**
 * Validate metadata extension parameters
 * 
 * @param connection - ABAP connection instance
 * @param params - Validation parameters
 * @returns Validation result
 */
export async function validateMetadataExtension(
  connection: AbapConnection,
  params: MetadataExtensionValidationParams
): Promise<{ valid: boolean; errors?: string[] }> {
  const errors: string[] = [];

  if (!params.name || params.name.trim() === '') {
    errors.push('Metadata extension name is required');
  }

  if (!params.description || params.description.trim() === '') {
    errors.push('Description is required');
  }

  if (!params.packageName || params.packageName.trim() === '') {
    errors.push('Package name is required');
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined
  };
}
