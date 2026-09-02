import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import {
  type CheckRunVersion,
  parseCheckRunResponse,
  runCheckRun,
} from '../../utils/checkRun';

export async function checkScalarFunction(
  connection: IAbapConnection,
  name: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    'scalar_function',
    name,
    version,
    'abapCheckRun',
    sourceCode,
  );
  const checkResult = parseCheckRunResponse(response);
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Scalar function check failed: ${errorMessages}`);
  }
  return response;
}
