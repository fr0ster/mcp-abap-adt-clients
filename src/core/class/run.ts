/**
 * Class run operations - execute ABAP classes that implement if_oo_adt_classrun
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';

/**
 * Run an ABAP class that implements if_oo_adt_classrun interface.
 *
 * This executes the class's main() method and returns console output.
 * The class must implement if_oo_adt_classrun interface to be executable.
 *
 * Endpoint: POST /sap/bc/adt/oo/classrun/{className}
 *
 * Use cases:
 * - Execute test/demo classes
 * - Run data migration scripts
 * - Execute batch processing classes
 * - Quick code testing without creating programs
 *
 * @param connection - SAP connection
 * @param className - Name of the class to run (must implement if_oo_adt_classrun)
 * @param runnable - Optional flag to check if class is runnable (default: true, throws error if false)
 * @param sessionId - Optional session ID for session-based requests
 * @returns Response with console output from the class execution
 * @throws Error if runnable is false, or if class doesn't implement if_oo_adt_classrun or execution fails
 *
 * @example
 * ```typescript
 * // Class must implement if_oo_adt_classrun:
 * // CLASS zcl_test DEFINITION PUBLIC FINAL CREATE PUBLIC.
 * //   PUBLIC SECTION.
 * //     INTERFACES if_oo_adt_classrun.
 * // ENDCLASS.
 * //
 * // CLASS zcl_test IMPLEMENTATION.
 * //   METHOD if_oo_adt_classrun~main.
 * //     out->write( 'Hello World' ).
 * //   ENDMETHOD.
 * // ENDCLASS.
 *
 * const result = await runClass(connection, 'ZCL_TEST', true);
 * console.log(result.data); // Console output from the class
 *
 * // Check if class is runnable before attempting to run
 * if (classConfig.runnable) {
 *   const result = await runClass(connection, 'ZCL_TEST', true);
 * }
 * ```
 */
export async function runClass(
  connection: AbapConnection,
  className: string,
  runnable: boolean = true,
  sessionId?: string
): Promise<AxiosResponse> {
  if (!runnable) {
    throw new Error(`Class ${className} is not marked as runnable (does not implement if_oo_adt_classrun)`);
  }

  const url = `/sap/bc/adt/oo/classrun/${className}`;

  const headers = {
    'Accept': 'text/plain'
  };

  if (sessionId) {
    const { makeAdtRequestWithSession } = await import('../../utils/sessionUtils');
    return makeAdtRequestWithSession(connection, url, 'POST', sessionId, '', headers);
  } else {
    const baseUrl = await connection.getBaseUrl();
    return connection.makeAdtRequest({
      url: `${baseUrl}${url}`,
      method: 'POST',
      timeout: (await import('@mcp-abap-adt/connection')).getTimeout('default'),
      headers
    });
  }
}
