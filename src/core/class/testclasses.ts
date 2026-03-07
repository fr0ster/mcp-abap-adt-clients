/**
 * Class test include operations
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import {
  ACCEPT_LOCK,
  ACCEPT_SOURCE,
  CT_SOURCE,
} from '../../constants/contentTypes';
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
): Promise<AxiosResponse> {
  if (!testClassSource) {
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

export async function lockClassTestClasses(
  connection: IAbapConnection,
  className: string,
): Promise<string> {
  const encodedName = encodeSapObjectName(className).toLowerCase();
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    Accept: ACCEPT_LOCK,
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers,
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const result = parser.parse(response.data);
  const lockHandle = result?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error(
      'Failed to obtain lock handle for test classes. They may already be locked by another user.',
    );
  }

  return lockHandle;
}

export async function unlockClassTestClasses(
  connection: IAbapConnection,
  className: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  if (!lockHandle) {
    throw new Error('lockHandle is required to unlock test classes');
  }

  const encodedName = encodeSapObjectName(className).toLowerCase();
  const url = `/sap/bc/adt/oo/classes/${encodedName}/includes/testclasses?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: null,
    headers,
  });
}

export async function activateClassTestClasses(
  connection: IAbapConnection,
  className: string,
  testClassName: string,
): Promise<AxiosResponse> {
  const encodedClass = encodeSapObjectName(className).toLowerCase();
  const encodedTest = encodeSapObjectName(testClassName).toUpperCase();
  const objectUri = `/sap/bc/adt/oo/classes/${encodedClass}#testclass=${encodedTest}`;
  const objectName = `${className.toUpperCase()}#${encodedTest}`;
  return activateObjectInSession(connection, objectUri, objectName, true);
}
