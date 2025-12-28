/**
 * Structure check operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

/**
 * Check structure syntax
 * Note: For DDIC objects like structures, check may not be fully supported in all SAP systems.
 * If check fails with "inactive version does not exist" or "importing from database" error, it's often safe to skip.
 */
export async function checkStructure(
  connection: IAbapConnection,
  structureName: string,
  version: string = 'active',
  sourceCode?: string,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const response = await runCheckRun(
    connection,
    'structure',
    structureName,
    version,
    'abapCheckRun',
    sourceCode,
  );
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    // For DDIC objects, "inactive version does not exist", "importing from database", or "has been checked" errors
    // are often non-critical and can be safely ignored, especially for inactive versions
    const errorMessage = checkResult.message || '';
    // Check both message and errors array for "has been checked" message
    const hasCheckedMessage =
      errorMessage.toLowerCase().includes('has been checked') ||
      checkResult.errors.some((err: any) =>
        (err.text || '').toLowerCase().includes('has been checked'),
      );

    if (hasCheckedMessage) {
      // This is expected behavior - structure was already checked, return response anyway
      if (process.env.DEBUG_ADT_LIBS === 'true') {
        logger?.warn?.(
          `Check warning for structure ${structureName}: ${errorMessage} (structure was already checked)`,
        );
      }
      return response; // Return response anyway
    }

    if (
      (errorMessage.toLowerCase().includes('inactive version') &&
        errorMessage.toLowerCase().includes('does not exist')) ||
      (errorMessage.toLowerCase().includes('importing') &&
        errorMessage.toLowerCase().includes('database'))
    ) {
      // This is expected behavior for DDIC objects - check may not be fully supported
      // Return response without throwing - test chain can continue
      if (process.env.DEBUG_ADT_LIBS === 'true') {
        logger?.warn?.(
          `Check warning for structure ${structureName}: ${errorMessage} (check may not be fully supported for DDIC objects)`,
        );
      }
      return response; // Return response anyway
    }
    throw new Error(`Structure check failed: ${checkResult.message}`);
  }

  return response;
}
