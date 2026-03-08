/**
 * Check CDS view availability for unit test doubles
 * Uses ADT endpoint: /sap/bc/adt/aunit/dbtestdoubles/cds/validation
 *
 * This is NOT a standard ADT validation (which checks name/params before create).
 * It checks whether a CDS view can be used with the test doubles framework
 * (cl_cds_test_environment).
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Check CDS view availability for unit test doubles
 *
 * Endpoint: POST /sap/bc/adt/aunit/dbtestdoubles/cds/validation?ddlName={viewName}
 *
 * What this checks:
 * - Whether the CDS view is active (must be activated before check)
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
export async function checkCdsTestDoublesAvailability(
  connection: IAbapConnection,
  viewName: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/aunit/dbtestdoubles/cds/validation`;
  const encodedName = encodeSapObjectName(viewName);

  const queryParams = new URLSearchParams({
    ddlName: encodedName,
  });

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept:
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.StatusMessage',
    },
  });
}
