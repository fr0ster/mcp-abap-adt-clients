import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

/**
 * Check access control syntax
 */
export async function checkAccessControl(
  connection: IAbapConnection,
  accessControlName: string,
  version: string = 'inactive',
  sourceCode?: string,
): Promise<AxiosResponse> {
  const response = await runCheckRun(
    connection,
    'access_control',
    accessControlName,
    version,
    'abapCheckRun',
    sourceCode,
  );
  const checkResult = parseCheckRunResponse(response);

  // "has been checked" or "was checked" messages are normal responses, not errors
  const hasCheckedMessage =
    checkResult.message?.toLowerCase().includes('has been checked') ||
    checkResult.message?.toLowerCase().includes('was checked') ||
    checkResult.errors.some((err: any) =>
      (err.text || '').toLowerCase().includes('has been checked'),
    );

  if (hasCheckedMessage) {
    return response;
  }

  // Only throw error if there are actual problems (ERROR or WARNING)
  if (!checkResult.success && checkResult.has_errors) {
    throw new Error(`Access control check failed: ${checkResult.message}`);
  }

  return response;
}
