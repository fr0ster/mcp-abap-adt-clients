import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { CheckRunVersion } from '../../utils/checkRun';
import { requestHeaders } from '../../utils/requestHeaders';
/**
 * Behavior Definition check operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { BEHAVIOR_DEFINITION, sourceUri } from '../../endpoints/objects';
import type { CheckReporter } from './types';

/**
 * Run check on behavior definition
 *
 * Endpoint: POST /sap/bc/adt/checkruns?reporters={reporter}
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param reporter - Check reporter type
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @param sourceCode - Optional source code to check (will be base64 encoded)
 * @returns Axios response with check results (XML)
 *
 * @example
 * ```typescript
 * // Check saved version
 * const implResult = await check(connection, 'Z_MY_BDEF', 'bdefImplementationCheck', sessionId);
 *
 * // Check unsaved source code
 * const syntaxResult = await check(connection, 'Z_MY_BDEF', 'abapCheckRun', sessionId, 'inactive', sourceCode);
 * ```
 */
export async function check(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
  reporter: CheckReporter,
  _sessionId: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  let xmlBody: string;

  if (sourceCode) {
    // Check with source code content (for unsaved changes)
    // TODO: analyze whether chkrun:contentType can be extracted to a constant
    const base64Content = Buffer.from(sourceCode, 'utf-8').toString('base64');
    xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="${BEHAVIOR_DEFINITION.uri(name)}" chkrun:version="${version}">
        <chkrun:artifacts>
            <chkrun:artifact chkrun:contentType="text/plain; charset=utf-8" chkrun:uri="${sourceUri(BEHAVIOR_DEFINITION.uri(name))}">
                <chkrun:content>${base64Content}</chkrun:content>
            </chkrun:artifact>
        </chkrun:artifacts>
    </chkrun:checkObject>
</chkrun:checkObjectList>`;
  } else {
    // Check saved version
    xmlBody = `<?xml version="1.0" encoding="UTF-8"?><chkrun:checkObjectList xmlns:chkrun="http://www.sap.com/adt/checkrun" xmlns:adtcore="http://www.sap.com/adt/core">
    <chkrun:checkObject adtcore:uri="${BEHAVIOR_DEFINITION.uri(name)}" chkrun:version="${version}"/>
</chkrun:checkObjectList>`;
  }

  const url = `/sap/bc/adt/checkruns?reporters=${reporter}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: 0,
    data: xmlBody,
    headers: requestHeaders(headers),
  });
}

/**
 * Check behavior definition implementation
 *
 * Uses bdefImplementationCheck reporter
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @param sourceCode - Optional source code to check
 * @returns Axios response with check results
 *
 * @example
 * ```typescript
 * // Check saved version
 * const result = await checkImplementation(connection, 'Z_MY_BDEF', sessionId);
 *
 * // Check unsaved changes
 * const result = await checkImplementation(connection, 'Z_MY_BDEF', sessionId, 'inactive', sourceCode);
 * ```
 */
export async function checkImplementation(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
  sessionId: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  return check(
    connection,
    headers,
    name,
    'bdefImplementationCheck',
    sessionId,
    version,
    sourceCode,
  );
}

/**
 * Check behavior definition ABAP syntax
 *
 * Uses abapCheckRun reporter
 *
 * @param connection - ABAP connection instance
 * @param name - Behavior definition name
 * @param sessionId - Session ID for request tracking
 * @param version - Version to check (default: inactive)
 * @param sourceCode - Optional source code to check
 * @returns Axios response with check results
 *
 * @example
 * ```typescript
 * // Check saved version
 * const result = await checkAbap(connection, 'Z_MY_BDEF', sessionId);
 *
 * // Check unsaved changes
 * const result = await checkAbap(connection, 'Z_MY_BDEF', sessionId, 'inactive', sourceCode);
 * ```
 */
export async function checkAbap(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  name: string,
  sessionId: string,
  version: CheckRunVersion = 'inactive',
  sourceCode?: string,
): Promise<IAdtWireResponse> {
  return check(
    connection,
    headers,
    name,
    'abapCheckRun',
    sessionId,
    version,
    sourceCode,
  );
}
