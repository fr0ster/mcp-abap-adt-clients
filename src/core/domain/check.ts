/**
 * Domain check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../shared/checkRun';

/**
 * Check domain syntax
 *
 * @param connection - SAP connection
 * @param domainName - Domain name
 * @param version - 'active' (activated version) or 'inactive' (saved but not activated)
 * @param sessionId - Session ID (required for domain operations)
 * @returns Check result with errors/warnings
 */
export async function checkDomainSyntax(
  connection: AbapConnection,
  domainName: string,
  version: 'active' | 'inactive',
  sessionId: string
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'domain', domainName, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Domain check failed: ${checkResult.message}`);
  }

  return response;
}

