/**
 * View check operations
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

/**
 * Check view (DDLS) syntax
 */
function shouldRetryMissingVersion(
  checkResult: ReturnType<typeof parseCheckRunResponse>,
): boolean {
  if (checkResult.status !== 'notProcessed') {
    return false;
  }
  const message = (checkResult.message || '').toLowerCase();
  return (
    message.includes('does not exist') ||
    message.includes('missing data definition')
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function checkView(
  connection: IAbapConnection,
  viewName: string,
  version: string = 'active',
  sourceCode?: string,
): Promise<AxiosResponse> {
  let attempt = 0;
  // Allow one retry when system did not materialize inactive version yet
  while (attempt < 2) {
    const response = await runCheckRun(
      connection,
      'view',
      viewName,
      version,
      'abapCheckRun',
      sourceCode,
    );
    const checkResult = parseCheckRunResponse(response);

    if (!checkResult.success && checkResult.has_errors) {
      const errorMessage = checkResult.message || '';
      const hasCheckedMessage =
        errorMessage.toLowerCase().includes('has been checked') ||
        checkResult.errors.some((err: any) =>
          (err.text || '').toLowerCase().includes('has been checked'),
        );

      if (hasCheckedMessage) {
        if (process.env.DEBUG_ADT_LIBS === 'true') {
          console.warn(
            `Check warning for view ${viewName}: ${errorMessage} (view was already checked)`,
          );
        }
        return response;
      }

      if (attempt === 0 && shouldRetryMissingVersion(checkResult)) {
        if (process.env.DEBUG_ADT_LIBS === 'true') {
          console.warn(
            `Check retry for view ${viewName}: ${errorMessage} (waiting for inactive version)`,
          );
        }
        attempt += 1;
        await delay(2000);
        continue;
      }

      if (shouldRetryMissingVersion(checkResult)) {
        if (process.env.DEBUG_ADT_LIBS === 'true') {
          console.warn(
            `Check warning for view ${viewName}: ${errorMessage} (version not available, continue)`,
          );
        }
        return response;
      }

      throw new Error(`View check failed: ${checkResult.message}`);
    }

    return response;
  }

  // Should not reach here because loop returns on success
  throw new Error(
    `View check failed: Version ${version} not available for ${viewName}`,
  );
}
