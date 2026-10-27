/**
 * The generic object reads, as the request they are.
 *
 * **Module functions, not members.** `AdtUtils` carried these beside
 * `readObjectSource` and `readObjectMetadata`, which called them and applied
 * `rawDocument` — one endpoint answered by two public members, differing only
 * in the reading. That is the shape decision 16 rules out, and the reason the
 * package walks and the where-used pair left in 19.0.0.
 *
 * So one member stays per endpoint, and the callers inside this package that
 * want the whole exchange — a per-type `read.ts` building its own answer — call
 * the function directly. A function is not a second way to ask the same
 * question; it is the one way, used by the member and by us.
 */
import type {
  AdtSourceTypeCode,
  AdtTypeCode,
  IReadOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import {
  ACCEPT_CLASS,
  ACCEPT_DATA_ELEMENT,
  ACCEPT_DOMAIN,
  ACCEPT_FUNCTION_GROUP,
  ACCEPT_FUNCTION_MODULE,
  ACCEPT_INTERFACE,
  ACCEPT_PACKAGE,
  ACCEPT_PROGRAM,
  ACCEPT_STRUCTURE,
  ACCEPT_TABLE,
  ACCEPT_TABLE_TYPE,
  CT_VIEW,
} from '../../constants/contentTypes';
import { codeHas } from '../../endpoints/codes';
import { sourceUri } from '../../endpoints/objects';
import { buildObjectUri } from '../../utils/activationUtils';

export async function objectSourceWire(
  connection: IAbapConnection,
  objectType: AdtSourceTypeCode,
  objectName: string,
  functionGroup?: string,
  version?: 'active' | 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  if (!supportsSourceCode(objectType)) {
    throw new Error(
      `Object type ${objectType} does not support source code reading`,
    );
  }

  let uri = getObjectSourceUri(objectType, objectName, functionGroup, version);
  if (options?.withLongPolling) {
    const separator = uri.includes('?') ? '&' : '?';
    uri += `${separator}withLongPolling=true`;
  }

  const acceptHeader = options?.accept ?? 'text/plain';
  return connection.makeAdtRequest({
    url: uri,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: acceptHeader,
    },
  });
}

/**
 * The metadata answer itself, for callers inside this package.
 *
 * The contract member above answers a document, because that is what a
 * consumer of {@link IAdtObjectAccess} reads. The per-type request functions
 * need the answer whole — status and headers included — so that the handler
 * can apply *its* consumer's strategy to it, and reading it here would throw
 * that away and make them read it back out of a string.
 */
export async function objectMetadataWire(
  connection: IAbapConnection,
  objectType: AdtTypeCode,
  objectName: string,
  functionGroup?: string,
  options?: IReadOptions,
  logger?: ILogger,
): Promise<IAdtWireResponse> {
  let uri = getObjectMetadataUri(objectType, objectName, functionGroup);
  const params = [];
  if (options?.version) {
    params.push(`version=${options.version}`);
  }
  if (options?.withLongPolling) {
    params.push('withLongPolling=true');
  }
  if (params.length > 0) {
    uri += `?${params.join('&')}`;
  }
  const acceptHeader = options?.accept ?? getMetadataAcceptHeader(objectType);
  return connection.makeAdtRequest({
    url: uri,
    method: 'GET',
    timeout: 0,
    headers: {
      Accept: acceptHeader,
    },
  });
}

/**
 * An object's metadata address: its address from the type tables. A
 * parented code takes its parent as `functionGroup`, the only parent the
 * tables name (`FUGR/FF`, `FUGR/I` under `functionGroup`).
 */
export function getObjectMetadataUri(
  objectType: AdtTypeCode,
  objectName: string,
  functionGroup?: string,
): string {
  return buildObjectUri(objectName, objectType, functionGroup);
}

/**
 * The Accept each code's metadata document is asked for by default; a code
 * not listed is asked for `application/xml`, as before. Keyed by the tables'
 * codes — the friendly names and the codes no release lists that it carried
 * before interfaces-adt 21.0.0 map to these (`stru/dt` → `TABL/DS`,
 * `ttyp/df` → `TTYP/DA`, `fugr` → `FUGR/F`).
 */
const METADATA_ACCEPT: Readonly<Partial<Record<AdtTypeCode, string>>> = {
  'CLAS/OC': ACCEPT_CLASS,
  'INTF/OI': ACCEPT_INTERFACE,
  'TABL/DT': ACCEPT_TABLE,
  'TTYP/DA': ACCEPT_TABLE_TYPE,
  'DOMA/DD': ACCEPT_DOMAIN,
  'DTEL/DE': ACCEPT_DATA_ELEMENT,
  'TABL/DS': ACCEPT_STRUCTURE,
  'DDLS/DF': CT_VIEW,
  'PROG/P': ACCEPT_PROGRAM,
  'FUGR/F': ACCEPT_FUNCTION_GROUP,
  'FUGR/FF': ACCEPT_FUNCTION_MODULE,
  'DEVC/K': ACCEPT_PACKAGE,
};

export function getMetadataAcceptHeader(objectType: AdtTypeCode): string {
  return METADATA_ACCEPT[objectType] ?? 'application/xml';
}

/** An object's main source: its address from the tables, then `/source/main`. */
export function getObjectSourceUri(
  objectType: AdtSourceTypeCode,
  objectName: string,
  functionGroup?: string,
  version?: 'active' | 'inactive',
): string {
  const versionParam = version ? `?version=${version}` : '';
  return `${sourceUri(buildObjectUri(objectName, objectType, functionGroup))}${versionParam}`;
}

/** Whether a table lists `source` for the code. */
export function supportsSourceCode(objectType: AdtTypeCode): boolean {
  return codeHas(objectType, 'source');
}
