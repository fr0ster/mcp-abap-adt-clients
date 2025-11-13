/**
 * Domain activation operations
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { activateObjectInSession } from '../../utils/activationUtils';

/**
 * Activate domain
 * Makes domain active and usable in SAP system
 */
export async function activateDomain(
  connection: AbapConnection,
  domainName: string,
  sessionId: string
): Promise<AxiosResponse> {
  const objectUri = `/sap/bc/adt/ddic/domains/${encodeSapObjectName(domainName.toLowerCase())}`;
  return await activateObjectInSession(connection, objectUri, domainName.toUpperCase(), sessionId, true);
}

