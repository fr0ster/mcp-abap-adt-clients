import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

export async function checkAppendStructure(
  connection: IAbapConnection,
  name: string,
  version: string = 'inactive',
  sourceCode?: string,
): Promise<AxiosResponse> {
  const response = await runCheckRun(
    connection,
    'append_structure',
    name,
    version,
    'abapCheckRun',
    sourceCode,
  );
  const checkResult = parseCheckRunResponse(response);
  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Append structure check failed: ${errorMessages}`);
  }
  return response;
}
