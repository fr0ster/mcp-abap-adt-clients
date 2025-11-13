/**
 * Domain check operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { runCheckRun, parseCheckRunResponse } from '../shared/checkRun';

/**
 * Check domain syntax
 */
export async function checkDomainSyntax(
  connection: AbapConnection,
  domainName: string,
  sessionId: string,
  version: string = 'new'
): Promise<AxiosResponse> {
  const response = await runCheckRun(connection, 'domain', domainName, version, 'abapCheckRun', sessionId);
  const checkResult = parseCheckRunResponse(response);

  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Domain check failed: ${checkResult.message}`);
  }

  return response;
}

