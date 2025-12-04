/**
 * Domain check operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../../utils/checkRun';

/**
 * Check domain syntax
 *
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sourceCode - Optional source code to validate
 * @returns Check result with errors/warnings
 */
export async function checkDomainSyntax(
  connection: IAbapConnection,
  domainName: string,
  version: 'active' | 'inactive',
  sourceCode?: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'domain', domainName, version, 'abapCheckRun', sourceCode);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    // "has been checked" is a non-critical warning - domain was already checked
    const errorMessage = checkResult.message || '';
    // Check both message and errors array for "has been checked" message
    const hasCheckedMessage = errorMessage.toLowerCase().includes('has been checked') ||
      checkResult.errors.some((err: any) => (err.text || '').toLowerCase().includes('has been checked'));

    if (hasCheckedMessage) {
      // This is expected behavior - domain was already checked, return response anyway
      if (process.env.DEBUG_ADT_LIBS === 'true') {
        console.warn(`Check warning for domain ${domainName}: ${errorMessage} (domain was already checked)`);
      }
      return response; // Return response anyway
    }
    throw new Error(`Domain check failed: ${checkResult.message}`);
  }

  return response;
}

