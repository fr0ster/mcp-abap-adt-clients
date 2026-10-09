/**
 * Class test include operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { CLASS, CLASS_INCLUDE } from '../../endpoints/objects';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName, writeQuery } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Upload ABAP Unit test classes for an existing class (low-level function).
 * Requires the class to be locked (lock handle) before calling.
 */
export async function updateClassTestInclude(
  connection: IAbapConnection,
  className: string,
  testClassSource: string,
  lockHandle?: string,
  transportRequest?: string,
  sourceContentType?: string,
): Promise<IAdtWireResponse> {
  // Empty source is legitimate: PUTting it is how a test class is deleted.
  // Only a missing argument is an error.

  const url = `${CLASS_INCLUDE.uri(className, 'testclasses')}${writeQuery(lockHandle, transportRequest)}`;

  const contentType = sourceContentType || CT_SOURCE;
  const headers = {
    'Content-Type': contentType,
    Accept: ACCEPT_SOURCE,
  };

  return await connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: testClassSource,
    headers,
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
  return activateObjectInSession(connection, objectUri, objectName, true);
}
