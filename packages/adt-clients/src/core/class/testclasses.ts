/**
 * Class test include operations
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACTIVATION_HEADERS } from '../../constants/contentTypes';
import { CLASS, CLASS_INCLUDE } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { requestHeaders } from '../../utils/requestHeaders';

/**
 * Upload ABAP Unit test classes for an existing class (low-level function).
 * Requires the class to be locked (lock handle) before calling.
 */
export async function updateClassTestInclude(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  className: string,
  testClassSource: string,
  lockHandle?: string,
  transportRequest?: string,
): Promise<IAdtWireResponse> {
  // Empty source is legitimate: PUTting it is how a test class is deleted.
  // Only a missing argument is an error.

  const url = `${CLASS_INCLUDE.uri(className, 'testclasses')}${writeQuery(lockHandle, transportRequest)}`;

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: 0,
    data: testClassSource,
    headers: requestHeaders(headers),
  });
}

export async function activateClassTestClasses(
  connection: IAbapConnection,
  className: string,
  testClassName: string,
): Promise<IAdtWireResponse> {
  const encodedTest = encodeSapObjectName(testClassName).toUpperCase();
  const objectUri = `${CLASS.uri(className)}#testclass=${encodedTest}`;
  const objectName = `${className.toUpperCase()}#${encodedTest}`;
  return activateObjectInSession(
    connection,
    ACTIVATION_HEADERS,
    objectUri,
    objectName,
    true,
  );
}
