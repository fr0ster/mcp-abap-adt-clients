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
  AdtObjectType,
  AdtSourceObjectType,
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
  IReadOptions,
} from '@mcp-abap-adt/interfaces';
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
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function objectSourceWire(
  connection: IAbapConnection,
  objectType: AdtSourceObjectType,
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
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url: uri,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: acceptHeader,
      },
    },
    { logger },
  );
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
  objectType: AdtObjectType,
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
  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url: uri,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: acceptHeader,
      },
    },
    { logger },
  );
}

export function getObjectMetadataUri(
  objectType: AdtObjectType,
  objectName: string,
  functionGroup?: string,
): string {
  const encodedName = encodeSapObjectName(objectName);

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case 'functionmodule':
    case 'fugr/ff': {
      const encodedGroup = encodeSapObjectName(functionGroup as string);
      return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}`;
    }
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case 'tabletype':
    case 'ttyp/df':
      return `/sap/bc/adt/ddic/tabletypes/${encodedName}`;
    case 'domain':
    case 'doma/dd':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'dataelement':
    case 'dtel':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    case 'functiongroup':
    case 'fugr':
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case 'package':
    case 'devc/k':
      return `/sap/bc/adt/packages/${encodedName}`;
    default:
      throw new Error(`Unsupported object type for metadata: ${objectType}`);
  }
}

export function getMetadataAcceptHeader(objectType: AdtObjectType): string {
  const type = objectType.toLowerCase();

  switch (type) {
    case 'class':
    case 'clas/oc':
      return ACCEPT_CLASS;
    case 'interface':
    case 'intf/if':
      return ACCEPT_INTERFACE;
    case 'table':
    case 'tabl/dt':
      return ACCEPT_TABLE;
    case 'tabletype':
    case 'ttyp/df':
      return ACCEPT_TABLE_TYPE;
    case 'domain':
    case 'doma/dd':
      return ACCEPT_DOMAIN;
    case 'dataelement':
    case 'dtel':
      return ACCEPT_DATA_ELEMENT;
    case 'structure':
    case 'stru/dt':
      return ACCEPT_STRUCTURE;
    case 'view':
    case 'ddls/df':
      return CT_VIEW;
    case 'program':
    case 'prog/p':
      return ACCEPT_PROGRAM;
    case 'functiongroup':
    case 'fugr':
      return ACCEPT_FUNCTION_GROUP;
    case 'functionmodule':
    case 'fugr/ff':
      return ACCEPT_FUNCTION_MODULE;
    case 'package':
    case 'devc/k':
      return ACCEPT_PACKAGE;
    default:
      return 'application/xml';
  }
}

export function getObjectSourceUri(
  objectType: AdtSourceObjectType,
  objectName: string,
  functionGroup?: string,
  version?: 'active' | 'inactive',
): string {
  const encodedName = encodeSapObjectName(objectName);
  const versionParam = version ? `?version=${version}` : '';

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}/source/main${versionParam}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}/source/main${versionParam}`;
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}/source/main${versionParam}`;
    case 'functionmodule':
    case 'fugr/ff': {
      const encodedGroup = encodeSapObjectName(functionGroup as string);
      return `/sap/bc/adt/functions/groups/${encodedGroup}/fmodules/${encodedName}/source/main${versionParam}`;
    }
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}/source/main${versionParam}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}/source/main${versionParam}`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}/source/main${versionParam}`;
    case 'tabletype':
    case 'ttyp/df':
      return `/sap/bc/adt/ddic/tabletypes/${encodedName}/source/main${versionParam}`;
    default:
      throw new Error(
        `Object type ${objectType} does not support source code reading`,
      );
  }
}

export function supportsSourceCode(objectType: AdtObjectType): boolean {
  const supportedTypes = [
    'class',
    'clas/oc',
    'program',
    'prog/p',
    'interface',
    'intf/if',
    'functionmodule',
    'fugr/ff',
    'view',
    'ddls/df',
    'structure',
    'stru/dt',
    'table',
    'tabl/dt',
    'tabletype',
    'ttyp/df',
  ];
  return supportedTypes.includes(objectType.toLowerCase());
}
