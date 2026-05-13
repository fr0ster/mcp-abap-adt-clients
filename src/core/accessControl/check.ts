import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check access control syntax
 *
 * Retries once on transient `status='notProcessed'` with empty errors —
 * observed on cloud trial under full-suite load, where the CHECK reporter
 * occasionally returns has_errors=true without findings because async
 * validation has not materialized yet (#20). After the retry, if the state
 * persists with no real errors, downgrade to a warning and return the
 * response instead of throwing with an empty message.
 */
export async function checkAccessControl(
  connection: IAbapConnection,
  accessControlName: string,
  version: string = 'inactive',
  sourceCode?: string,
  logger?: ILogger,
): Promise<AxiosResponse> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await runCheckRun(
      connection,
      'access_control',
      accessControlName,
      version,
      'abapCheckRun',
      sourceCode,
    );
    const checkResult = parseCheckRunResponse(response);

    if (!checkResult.has_errors) {
      return response;
    }

    if (checkResult.errors.length > 0) {
      const errorMessages = checkResult.errors
        .map((err) => err.text)
        .join('; ');
      throw new Error(`Access control check failed: ${errorMessages}`);
    }

    // has_errors=true but errors is empty — driven by status='notProcessed'
    // in parseCheckRunResponse. Likely transient under load.
    if (attempt === 0) {
      logger?.warn?.(
        `Access control check returned has_errors=true with empty errors (status=${checkResult.status}, message=${checkResult.message || 'none'}); retrying once`,
      );
      await delay(2000);
      continue;
    }

    logger?.warn?.(
      `Access control check still has_errors=true with empty errors after retry (status=${checkResult.status}, message=${checkResult.message || 'none'}); treating as transient and continuing`,
    );
    return response;
  }

  // Unreachable: loop returns on every path
  throw new Error(
    `Access control check failed: unexpected control flow for ${accessControlName}`,
  );
}
