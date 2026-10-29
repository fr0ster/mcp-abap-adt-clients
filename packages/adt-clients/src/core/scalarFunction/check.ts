import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

export async function checkScalarFunction(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    headers,
    { type: 'DSFD/SCF', name: name },
    version,
    'abapCheckRun',
    sourceCode,
  );
  return response;
}
