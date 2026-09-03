import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  type CheckRunVersion,
  parseCheckRunResponse,
  runCheckRun,
} from '../../utils/checkRun';

/**
 * Check transformation syntax
 */
export async function checkTransformation(
  connection: IAbapConnection,
  transformationName: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    'transformation',
    transformationName,
    version,
    'abapCheckRun',
    sourceCode,
  );
  const checkResult = parseCheckRunResponse(response);

  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Transformation check failed: ${errorMessages}`);
  }

  return response;
}
