/**
 * Class activation operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate class
 * Makes class active and usable in SAP system
 * 
 * NOTE: Requires stateful session mode enabled via connection.setSessionType("stateful")
 */
export async function activateClass(
  connection: AbapConnection,
  className: string
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/oo/classes/${encodeSapObjectName(className).toLowerCase()}`;
  return await activateObjectInSession(connection, objectUri, className, true);
}

