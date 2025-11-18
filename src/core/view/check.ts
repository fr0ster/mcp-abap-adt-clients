/**
 * View check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../shared/checkRun';

/**
 * Check view (DDLS) syntax
 */
export async function checkView(
  connection: AbapConnection,
  viewName: string,
  version: string = 'active',
  sessionId?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'view', viewName, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    // "has been checked" is a non-critical warning - view was already checked
    const errorMessage = checkResult.message || '';
    // Check both message and errors array for "has been checked" message
    const hasCheckedMessage = errorMessage.toLowerCase().includes('has been checked') ||
      checkResult.errors.some((err: any) => (err.text || '').toLowerCase().includes('has been checked'));

    if (hasCheckedMessage) {
      // This is expected behavior - view was already checked, return response anyway
      if (process.env.DEBUG_TESTS === 'true') {
        console.warn(`Check warning for view ${viewName}: ${errorMessage} (view was already checked)`);
      }
      return response; // Return response anyway
    }
    throw new Error(`View check failed: ${checkResult.message}`);
  }

  return response;
}

