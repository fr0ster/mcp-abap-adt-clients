/**
 * Program activation operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { PROGRAM } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate program
 * Makes program active and usable in SAP system
 */
export async function activateProgram(
  connection: IAbapConnection,
  programName: string,
): Promise<IAdtWireResponse> {
  const objectUri = `${PROGRAM.uri(programName)}`;
  return await activateObjectInSession(
    connection,
    objectUri,
    programName,
    true,
  );
}
