/**
 * Validate CDS view for unit test doubles
 * Uses ADT validation endpoint: /sap/bc/adt/aunit/dbtestdoubles/cds/validation
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { getTimeout } from '../../utils/timeouts';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';

/**
 * Validate CDS view for unit test doubles
 * This validation is required before creating a CDS unit test class
 * 
 * Endpoint: POST /sap/bc/adt/aunit/dbtestdoubles/cds/validation?ddlName={viewName}
 * 
 * What this validation checks:
 * - Whether the CDS view is active (must be activated before validation)
 * - Whether the view structure allows creation of test doubles (temporary updatable copies)
 * - Whether dependent components (tables, views) can be replaced with test doubles
 * - Whether there are any restrictions preventing use of the view in test doubles framework
 * - Whether the view can be used with cl_cds_test_environment for unit testing
 * 
 * Test doubles are temporary, updatable copies of dependent components created in the same
 * database schema, allowing unit testing of CDS views in isolation without real data.
 * 
 * Response format:
 * - Success: <SEVERITY>OK</SEVERITY>
 * - Error: <SEVERITY>ERROR</SEVERITY> with <SHORT_TEXT> and <LONG_TEXT>
 */
export async function validateCdsForUnitTest(
  connection: IAbapConnection,
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

