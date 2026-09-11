import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { type CheckRunVersion, runCheckRun } from '../../utils/checkRun';

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

  return response;
}
