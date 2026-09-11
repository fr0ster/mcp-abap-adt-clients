import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

export async function checkScalarFunctionImplementation(
  connection: IAbapConnection,
  name: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    'scalar_function_implementation',
    name,
    version,
    'abapCheckRun',
    sourceCode,
  );
  return response;
}
