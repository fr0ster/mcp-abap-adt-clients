/**
 * Interface activation operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate interface
 * Makes interface active and usable in SAP system
 */
export async function activateInterface(
  connection: AbapConnection,
  interfaceName: string
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/oo/interfaces/${encodeSapObjectName(interfaceName).toLowerCase()}`;
  return await activateObjectInSession(connection, objectUri, interfaceName, true);
}

