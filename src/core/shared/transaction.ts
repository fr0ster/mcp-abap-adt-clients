/**
 * Transaction operations for ABAP objects
 *
 * Retrieves transaction metadata (name, description, package, type) using
 * ADT object properties endpoint.
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get transaction properties (metadata) for ABAP transaction
 *
 * Uses ADT object properties endpoint to retrieve transaction information:
 * - Transaction name
 * - Description
 * - Package (if applicable)
 * - Transaction type
 *
 * @param connection - ABAP connection
 * @param transactionName - Transaction code (e.g., 'SE80', 'SE11', 'SM30')
 * @returns Axios response with XML containing transaction properties
 *          Response format: opr:objectProperties with opr:object containing
 *          name, text (description), package, type
 *
 * @example
 * ```typescript
 * const response = await getTransaction(connection, 'SE80');
 * // Response contains XML with transaction properties
 * ```
 */
export async function getTransaction(
  connection: IAbapConnection,
  transactionName: string,
): Promise<AxiosResponse> {
  if (!transactionName) {
    throw new Error('Transaction name is required');
  }

  // Build transaction URI following ADT conventions
  // Format: /sap/bc/adt/transactions/{transaction_name}
  const encodedName = encodeSapObjectName(transactionName.toLowerCase());
  const transactionUri = `/sap/bc/adt/transactions/${encodedName}`;

  // Query object properties endpoint with transaction URI
  const url = `/sap/bc/adt/repository/informationsystem/objectproperties/values?uri=${encodeURIComponent(transactionUri)}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: 'application/vnd.sap.adt.objectproperties+xml, application/xml',
    },
  });
}
