/**
 * Application Log Objects
 *
 * Provides functions for reading application log objects:
 * - Get application log object properties
 * - Get application log object source
 * - Validate application log object name
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { getTimeout } from '../../utils/timeouts';

/**
 * Get application log object options
 */
export interface IGetApplicationLogObjectOptions {
  corrNr?: string;
  lockHandle?: string;
  version?: string;
  accessMode?: string;
  action?: string;
}

/**
 * Get application log object properties
 *
 * @param connection - ABAP connection
 * @param objectName - Application log object name
 * @param options - Optional parameters
 * @returns Axios response with application log object properties
 */
export async function getApplicationLogObject(
  connection: IAbapConnection,
  objectName: string,
  options?: IGetApplicationLogObjectOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/applicationlog/objects/${objectName}`;
  const params: Record<string, any> = {};

  if (options?.corrNr) params.corrNr = options.corrNr;
  if (options?.lockHandle) params.lockHandle = options.lockHandle;
  if (options?.version) params.version = options.version;
  if (options?.accessMode) params.accessMode = options.accessMode;
  if (options?.action) params._action = options.action;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation':
        'http://www.sap.com/wbobj/applicationlogobjects/aplotyp/properties',
    },
  });
}

/**
 * Get application log object source options
 */
export interface IGetApplicationLogSourceOptions {
  corrNr?: string;
  lockHandle?: string;
  version?: string;
}

/**
 * Get application log object source
 *
 * @param connection - ABAP connection
 * @param objectName - Application log object name
 * @param options - Optional parameters
 * @returns Axios response with application log object source
 */
export async function getApplicationLogSource(
  connection: IAbapConnection,
  objectName: string,
  options?: IGetApplicationLogSourceOptions,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/applicationlog/objects/${objectName}/source/main`;
  const params: Record<string, any> = {};

  if (options?.corrNr) params.corrNr = options.corrNr;
  if (options?.lockHandle) params.lockHandle = options.lockHandle;
  if (options?.version) params.version = options.version;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
      'X-sap-adt-relation':
        'http://www.sap.com/wbobj/applicationlogobjects/aplotyp/source',
    },
  });
}

/**
 * Validate application log object name
 *
 * @param connection - ABAP connection
 * @param objectName - Application log object name to validate
 * @returns Axios response with validation result
 */
export async function validateApplicationLogName(
  connection: IAbapConnection,
  objectName: string,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/applicationlog/objects/validation`;
  const params: Record<string, any> = {};

  // Note: According to the template, validation might need objectName as a parameter
  // Adjust based on actual ADT endpoint behavior
  params.objectName = objectName;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    params,
    headers: {
      Accept: 'application/xml',
    },
  });
}
