/**
 * Program activation operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Activate program
 * Makes program active and usable in SAP system
 */
export async function activateProgram(
  connection: IAbapConnection,
  programName: string,
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    programName,
    true,
  );
}
