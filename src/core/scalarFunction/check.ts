import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

export async function checkScalarFunction(
  connection: IAbapConnection,
  name: string,
  version: string = 'inactive',
  sourceCode?: string,
): Promise<AxiosResponse> {
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
