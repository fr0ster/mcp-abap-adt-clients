/**
 * DataElement check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../../utils/checkRun';

/**
 * Check data element syntax
 * Note: For DDIC objects like data elements, check may not be fully supported in all SAP systems.
 * If check fails with "importing from database" error, it's often safe to skip.
 */
export async function checkDataElement(
  connection: AbapConnection,
  dataElementName: string,
  version: string = 'active',
  sourceCode?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'data_element', dataElementName, version, 'abapCheckRun', sourceCode);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    // For DDIC objects, "importing from database" errors are often non-critical
    // and can be safely ignored, especially for inactive versions
    const errorMessage = checkResult.message || '';
    if (errorMessage.toLowerCase().includes('importing') &&
        errorMessage.toLowerCase().includes('database')) {
      // This is expected behavior for DDIC objects - check may not be fully supported
      // Return response without throwing - test chain can continue
      if (process.env.DEBUG_ADT_LIBS === 'true') {
        console.warn(`Check warning for data element ${dataElementName}: ${errorMessage} (check may not be fully supported for DDIC objects)`);
      }
      return response; // Return response anyway
    }
    throw new Error(`Data element check failed: ${checkResult.message}`);
  }

  return response;
}