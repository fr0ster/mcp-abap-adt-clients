/**
 * Application job catalogs (`SAJC`) and templates (`SAJT`), read as their
 * definitions: the ADT object document and the source (`/source/main`). One
 * `GET` each; the name enters the address through `seg()`.
 */

import type { IGetApplicationJobOptions } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_APPLICATION_JOB_OBJECT,
  ACCEPT_APPLICATION_JOB_SOURCE,
} from '../../constants/contentTypes';
import {
  APPLICATION_JOB_CATALOG,
  APPLICATION_JOB_TEMPLATE,
  sourceUri,
} from '../../endpoints/objects';

/** Which of the two an address is built for. */
export type ApplicationJobKind = 'catalog' | 'template';

const RECORD = {
  catalog: APPLICATION_JOB_CATALOG,
  template: APPLICATION_JOB_TEMPLATE,
} as const;

function parametersOf(
  options: IGetApplicationJobOptions | undefined,
): Record<string, string> {
  const params: Record<string, string> = {};
  if (options?.version !== undefined) params.version = options.version;
  return params;
}

/** `GET` the object document of a catalog or a template. */
export async function getApplicationJobObject(
  connection: IAbapConnection,
  kind: ApplicationJobKind,
  name: string,
  options?: IGetApplicationJobOptions,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: RECORD[kind].uri(name),
    method: 'GET',
    timeout: 0,
    params: parametersOf(options),
    headers: { Accept: options?.accept ?? ACCEPT_APPLICATION_JOB_OBJECT },
  });
}

/** `GET` the source (`/source/main`) of a catalog or a template. */
export async function getApplicationJobSource(
  connection: IAbapConnection,
  kind: ApplicationJobKind,
  name: string,
  options?: IGetApplicationJobOptions,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: sourceUri(RECORD[kind].uri(name)),
    method: 'GET',
    timeout: 0,
    params: parametersOf(options),
    headers: { Accept: options?.accept ?? ACCEPT_APPLICATION_JOB_SOURCE },
  });
}
