/**
 * Class test include operations
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { activateObjectInSession } from '../../utils/activationUtils';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Upload ABAP Unit test classes for an existing class (low-level function).
 * Requires the class to be locked (lock handle) before calling.
 */
export async function updateClassTestInclude(
  connection: IAbapConnection,
  className: string,
  testClassSource: string,
  lockHandle: string,
  transportRequest?: string,
  sourceContentType?: string,
): Promise<IAdtWireResponse> {
  // Empty source is legitimate: PUTting it is how a test class is deleted.
  // Only a missing argument is an error.
  if (testClassSource === undefined || testClassSource === null) {
    throw new Error('Test class source code is required');
  }

  if (!lockHandle) {
    throw new Error('lockHandle is required to update test classes');
  }

  const encodedName = encodeSapObjectName(className).toLowerCase();
  let url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses?lockHandle=${encodeURIComponent(lockHandle)}`;
  if (transportRequest) {
    url += `&corrNr=${transportRequest}`;
  }

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
  const encodedClass = encodeSapObjectName(className).toLowerCase();
  const encodedTest = encodeSapObjectName(testClassName).toUpperCase();
  const objectUri = `/sap/bc/adt/oo/classes/${encodedClass}#testclass=${encodedTest}`;
  const objectName = `${className.toUpperCase()}#${encodedTest}`;
  return activateObjectInSession(connection, objectUri, objectName, true);
}
