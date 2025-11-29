/**
 * Validate CDS view for unit test doubles
 * Uses ADT validation endpoint: /sap/bc/adt/aunit/dbtestdoubles/cds/validation
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Validate CDS view for unit test doubles
 * This validation is required before creating a CDS unit test class
 * 
 * Endpoint: POST /sap/bc/adt/aunit/dbtestdoubles/cds/validation?ddlName={viewName}
 * 
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> and <LONG_TEXT>
 */
export async function validateCdsForUnitTest(
  connection: AbapConnection,
  viewName: string
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/aunit/dbtestdoubles/cds/validation`;
  const encodedName = encodeSapObjectName(viewName);
  
  const queryParams = new URLSearchParams({
    ddlName: encodedName
  });

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      'Accept': 'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage'
    }
  });
}

