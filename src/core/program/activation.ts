/**
 * Program activation operations
 */

import { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate program
 * Makes program active and usable in SAP system
 */
export async function activateProgram(
  connection: IAbapConnection,
  programName: string
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/programs/programs/${encodeSapObjectName(programName).toLowerCase()}`;
  return await activateObjectInSession(connection, objectUri, programName, true);
}

