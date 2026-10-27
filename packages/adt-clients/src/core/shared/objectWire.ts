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
  AdtParentedTypeCode,
  AdtSourceTypeCode,
  IReadOptions,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { sourceUri } from '../../endpoints/objects';
import { buildObjectUri } from '../../utils/activationUtils';
import { enhancementVersionToken } from '../enhancement/read';
import {
  type AdtMetadataReadCode,
  type AdtSourceReadCode,
  isSourceReadCode,
  METADATA_READ,
} from './codeSets';

export async function objectSourceWire(
  connection: IAbapConnection,
  objectType: AdtSourceReadCode,
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
  objectType: AdtMetadataReadCode,
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
 * tables name (`FUGR/FF` under `functionGroup`).
 */
export function getObjectMetadataUri(
  objectType: AdtMetadataReadCode,
  objectName: string,
  functionGroup?: string,
): string {
  return buildObjectUri(objectName, objectType, functionGroup);
}

/** The Accept a code's metadata document is asked for by default. */
export function getMetadataAcceptHeader(
  objectType: AdtMetadataReadCode,
): string {
  return METADATA_READ[objectType];
}

/**
 * The `version` each code's source is asked for, where it is not the word
 * itself: an enhancement's inactive source is its `workingArea`.
 */
const VERSION_TOKEN: Readonly<
  Partial<Record<AdtSourceTypeCode, (version: 'active' | 'inactive') => string>>
> = {
  'ENHO/XHH': enhancementVersionToken,
};

/**
 * An object's main source address: its address from the tables, then
 * `/source/main`, and the version as the code's own resource spells it. A
 * pure address — it sends nothing — so it is built for every code with a
 * source, the parent required for a parented one.
 */
export function getObjectSourceUri<C extends AdtSourceTypeCode>(
  objectType: C,
  objectName: string,
  ...[functionGroup, version]: [C] extends [AdtParentedTypeCode]
    ? [functionGroup: string, version?: 'active' | 'inactive']
    : [functionGroup?: string, version?: 'active' | 'inactive']
): string {
  const token = version
    ? (VERSION_TOKEN[objectType]?.(version) ?? version)
    : undefined;
  const versionParam = token ? `?version=${token}` : '';
  const code: AdtSourceTypeCode = objectType;
  return `${sourceUri(buildObjectUri(objectName, code, functionGroup))}${versionParam}`;
}

/**
 * Whether `readObjectSource` reads the code's source: the codes of
 * {@link SOURCE_READ}. Answered for any code, from outside the types too.
 */
export function supportsSourceCode(objectType: string): boolean {
  return isSourceReadCode(objectType);
}
