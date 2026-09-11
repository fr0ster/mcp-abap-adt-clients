import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

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
  return response;
}
