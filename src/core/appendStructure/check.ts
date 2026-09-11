import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

export async function checkAppendStructure(
  connection: IAbapConnection,
  name: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  const response = await runCheckRun(
    connection,
    'append_structure',
    name,
    version,
    'abapCheckRun',
    sourceCode,
  );
  return response;
}
