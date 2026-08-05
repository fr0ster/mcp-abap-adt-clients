import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import {
  type CheckRunVersion,
  parseCheckRunResponse,
  runCheckRun,
} from '../../utils/checkRun';

export async function checkScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtResponse> {
  const response = await runCheckRun(
    connection,
    'scalar_function_implementation',
    name,
    version,
    'abapCheckRun',
    sourceCode,
  );
  const checkResult = parseCheckRunResponse(response);
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(
      `Scalar function implementation check failed: ${errorMessages}`,
    );
  }
  return response;
}
