/**
 * Application Log Objects
 *
 * Provides functions for reading application log objects:
 * - Get application log object properties
 * - Get application log object source
 * - Validate application log object name
 */

import type {
  IGetApplicationLogObjectOptions,
  IGetApplicationLogSourceOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_APPLICATION_LOG_OBJECT,
  ACCEPT_APPLICATION_LOG_SOURCE,
} from '../../constants/contentTypes';
import { APPLICATION_LOG, sourceUri } from '../../endpoints/objects';

// Declared once, in the contract; re-exported so importers here are unchanged.
export type { IGetApplicationLogObjectOptions } from '@mcp-abap-adt/interfaces-adt';

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
): Promise<IAdtWireResponse> {
  const url = APPLICATION_LOG.uri(objectName);
  const params: Record<string, string | number | boolean> = {};

  if (options?.corrNr) params.corrNr = options.corrNr;
  if (options?.lockHandle) params.lockHandle = options.lockHandle;
  if (options?.version) params.version = options.version;
  if (options?.accessMode) params.accessMode = options.accessMode;
  if (options?.action) params._action = options.action;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    params,
    headers: {
      Accept: options?.accept ?? ACCEPT_APPLICATION_LOG_OBJECT,
      'X-sap-adt-relation':
        'http://www.sap.com/wbobj/applicationlogobjects/aplotyp/properties',
    },
  });
}

// Declared once, in the contract; re-exported so importers here are unchanged.
export type { IGetApplicationLogSourceOptions } from '@mcp-abap-adt/interfaces-adt';

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
): Promise<IAdtWireResponse> {
  const url = sourceUri(APPLICATION_LOG.uri(objectName));
  const params: Record<string, string | number | boolean> = {};

  if (options?.corrNr) params.corrNr = options.corrNr;
  if (options?.lockHandle) params.lockHandle = options.lockHandle;
  if (options?.version) params.version = options.version;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    params,
    headers: {
      Accept: options?.accept ?? ACCEPT_APPLICATION_LOG_SOURCE,
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
): Promise<IAdtWireResponse> {
  const url = APPLICATION_LOG.validation;
  const params: Record<string, string | number | boolean> = {};

  params.objectName = objectName;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    params,
    headers: {
      Accept: 'application/xml',
    },
  });
}
