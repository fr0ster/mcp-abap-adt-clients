/**
 * Where-used operations for ABAP objects
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import {
  ACCEPT_WHERE_USED_RESULT,
  ACCEPT_WHERE_USED_SCOPE,
  CT_WHERE_USED_REQUEST,
  CT_WHERE_USED_SCOPE,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type {
  IGetWhereUsedListParams,
  IGetWhereUsedParams,
  IGetWhereUsedScopeParams,
  IWhereUsedListResult,
  IWhereUsedReference,
} from './types';

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
});

/**
 * Modify where-used scope to enable/disable specific object types
 *
 * @param scopeXml - Scope XML from getWhereUsedScope()
 * @param options - Modification options
 * @returns Modified scope XML
 *
 * @example
 * const scopeResponse = await getWhereUsedScope(connection, { object_name: 'ZMY_CLASS', object_type: 'class' });
 * let scopeXml = scopeResponse.data;
 *
 * // Enable all types
 * scopeXml = modifyWhereUsedScope(scopeXml, { enableAll: true });
 *
 * // Enable specific types only
 * scopeXml = modifyWhereUsedScope(scopeXml, {
 *   enableOnly: ['CLAS/OC', 'INTF/OI', 'FUGR/FF']
 * });
 *
 * // Enable additional types (keeps existing selections)
 * scopeXml = modifyWhereUsedScope(scopeXml, {
 *   enable: ['FUGR/FF', 'TABL/DT']
 * });
 *
 * // Disable specific types
 * scopeXml = modifyWhereUsedScope(scopeXml, {
 *   disable: ['WDYN/YT', 'WAPA/WO']
 * });
 */
export function modifyWhereUsedScope(
  scopeXml: string,
  options: {
    enableAll?: boolean;
    enableOnly?: string[];
    enable?: string[];
    disable?: string[];
  },
): string {
  // Each available type is a self-closing <usagereferences:type .../> tag.
  // We rewrite ONLY the isSelected attribute per tag and never touch the
  // opaque <usagereferences:payload> blob or attribute ordering — SAP emits
  // attributes as `isDefault isSelected name`, so logic must read `name`
  // wherever it appears, not assume it precedes isSelected.
  const typeTagRegex = /<usagereferences:type\b[^>]*?\/>/g;

  return scopeXml.replace(typeTagRegex, (tag) => {
    const nameMatch = tag.match(/\bname="([^"]*)"/);
    const name = nameMatch ? nameMatch[1] : '';

    let selected: boolean | undefined;
    if (options.enableAll) {
      selected = true;
    } else if (options.enableOnly) {
      selected = options.enableOnly.includes(name);
    } else {
      if (options.enable?.includes(name)) selected = true;
      if (options.disable?.includes(name)) selected = false;
    }

    if (selected === undefined) return tag;
    return setIsSelected(tag, selected);
  });
}

/**
 * Set the isSelected attribute on a single <usagereferences:type> tag,
 * inserting it if absent. Leaves all other attributes and their order intact.
 */
function setIsSelected(typeTag: string, selected: boolean): string {
  const value = selected ? 'true' : 'false';
  if (/\bisSelected="(?:true|false)"/.test(typeTag)) {
    return typeTag.replace(
      /\bisSelected="(?:true|false)"/,
      `isSelected="${value}"`,
    );
  }
  return typeTag.replace(
    /<usagereferences:type\b/,
    `<usagereferences:type isSelected="${value}"`,
  );
}

/**
 * Build object URI based on type and name
 */
function buildObjectUri(objectName: string, objectType: string): string {
  const encodedName = encodeSapObjectName(objectName);

  switch (objectType.toLowerCase()) {
    case 'class':
    case 'clas/oc':
      return `/sap/bc/adt/oo/classes/${encodedName}`;
    case 'program':
    case 'prog/p':
      return `/sap/bc/adt/programs/programs/${encodedName}`;
    case 'include':
      return `/sap/bc/adt/programs/includes/${encodedName}`;
    case 'function':
    case 'functiongroup':
    case 'fugr':
      return `/sap/bc/adt/functions/groups/${encodedName}`;
    case 'functionmodule':
    case 'function_module':
    case 'fugr/ff':
      if (objectName.includes('|')) {
        const [group, fm] = objectName.split('|');
        return `/sap/bc/adt/functions/groups/${encodeSapObjectName(group)}/fmodules/${encodeSapObjectName(fm)}`;
      }
      throw new Error('Function module name must be in format GROUP|FM_NAME');
    case 'interface':
    case 'intf/if':
      return `/sap/bc/adt/oo/interfaces/${encodedName}`;
    case 'package':
    case 'devc/k':
      return `/sap/bc/adt/packages/${encodedName}`;
    case 'table':
    case 'tabl/dt':
      return `/sap/bc/adt/ddic/tables/${encodedName}`;
    case 'structure':
    case 'stru/dt':
      return `/sap/bc/adt/ddic/structures/${encodedName}`;
    case 'domain':
    case 'doma/dd':
      return `/sap/bc/adt/ddic/domains/${encodedName}`;
    case 'dataelement':
    case 'dtel':
      return `/sap/bc/adt/ddic/dataelements/${encodedName}`;
    case 'view':
    case 'ddls/df':
      return `/sap/bc/adt/ddic/ddl/sources/${encodedName}`;
    default:
      throw new Error(`Unsupported object type for where-used: ${objectType}`);
  }
}

/**
 * True when an error indicates the /usageReferences/scope sub-resource is not
 * available on the target system. SAP answers such requests with HTTP 404
 * ("No suitable resource found") — and 406 for an unaccepted media type — on
 * releases that do not expose the scope step. Callers use this to fall back to
 * an unscoped where-used search rather than failing outright.
 */
function isScopeResourceUnavailable(error: unknown): boolean {
  const status =
    // biome-ignore lint/suspicious/noExplicitAny: error shape is provider-defined
    (error as any)?.response?.status ?? (error as any)?.status;
  return status === 404 || status === 406;
}

/**
 * Get where-used scope configuration (Step 1 of 2)
 *
 * Returns available object types for where-used search.
 * Consumer can modify isSelected attributes before passing to getWhereUsed()
 *
 * @param connection - ABAP connection
 * @param params - Scope parameters
 * @returns Scope configuration XML with available object types
 *
 * @example
 * // Step 1: Get scope
 * const scopeResponse = await getWhereUsedScope(connection, {
 *   object_name: 'ZMY_CLASS',
 *   object_type: 'class'
 * });
 *
 * // Modify scope XML to select/deselect object types
 * let scopeXml = scopeResponse.data;
 * scopeXml = scopeXml.replace(/name="FUGR\/FF" isSelected="false"/, 'name="FUGR/FF" isSelected="true"');
 *
 * // Step 2: Execute search with modified scope
 * const result = await getWhereUsed(connection, {
 *   object_name: 'ZMY_CLASS',
 *   object_type: 'class',
 *   scopeXml: scopeXml
 * });
 */
export async function getWhereUsedScope(
  connection: IAbapConnection,
  params: IGetWhereUsedScopeParams,
): Promise<AxiosResponse> {
  if (!params.object_name) {
    throw new Error('Object name is required');
  }
  if (!params.object_type) {
    throw new Error('Object type is required');
  }

  const objectUri = buildObjectUri(params.object_name, params.object_type);
  const scopeUrl = `/sap/bc/adt/repository/informationsystem/usageReferences/scope?uri=${encodeURIComponent(objectUri)}`;
  const scopeRequestBody =
    '<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageScopeRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:affectedObjects/></usagereferences:usageScopeRequest>';

  return connection.makeAdtRequest({
    url: scopeUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: scopeRequestBody,
    headers: {
      'Content-Type': CT_WHERE_USED_SCOPE,
      Accept: ACCEPT_WHERE_USED_SCOPE,
    },
  });
}

/**
 * Get where-used references for ABAP object
 *
 * Posts directly to /usageReferences (the request the Eclipse ADT client
 * sends). An optional scope can be supplied to narrow the searched object types
 * server-side; when omitted, SAP applies its default scope. This function never
 * calls the /usageReferences/scope sub-resource itself — that resource is not
 * available on every system (see getWhereUsedScope).
 *
 * @param connection - ABAP connection
 * @param params - Where-used parameters
 * @param params.scopeXml - Optional scope XML from getWhereUsedScope(). When omitted, the search runs against SAP's default scope (unscoped).
 * @returns Where-used references
 */
export async function getWhereUsed(
  connection: IAbapConnection,
  params: IGetWhereUsedParams,
): Promise<AxiosResponse> {
  if (!params.object_name) {
    throw new Error('Object name is required');
  }
  if (!params.object_type) {
    throw new Error('Object type is required');
  }

  const objectUri = buildObjectUri(params.object_name, params.object_type);

  // Step 2: perform the actual where-used search.
  // We do NOT auto-fetch a default scope here. The Eclipse ADT client posts
  // directly to /usageReferences with a minimal request body and lets SAP apply
  // its default scope; the /usageReferences/scope sub-resource is not exposed on
  // every system (some S/4 releases answer 404 "No suitable resource found"), so
  // depending on it would break an otherwise-supported search. An explicit
  // <scope> is embedded only when the caller supplied one (the optional 2-step
  // optimisation that narrows the searched object types server-side).
  const searchUrl = `/sap/bc/adt/repository/informationsystem/usageReferences?uri=${encodeURIComponent(objectUri)}`;

  // When a scope is provided, extract the inner content of usageScopeResult and
  // re-wrap it as <usagereferences:scope>. Otherwise omit the scope element.
  const scopeContent = params.scopeXml
    ? params.scopeXml
        .replace(/<\?xml[^>]*\?>/, '')
        .replace(
          /<usagereferences:usageScopeResult[^>]*>/,
          '<usagereferences:scope>',
        )
        .replace(
          /<\/usagereferences:usageScopeResult>/,
          '</usagereferences:scope>',
        )
    : '';

  const searchRequestBody = `<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageReferenceRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:affectedObjects/>${scopeContent}</usagereferences:usageReferenceRequest>`;

  return connection.makeAdtRequest({
    url: searchUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: searchRequestBody,
    headers: {
      'Content-Type': CT_WHERE_USED_REQUEST,
      Accept: ACCEPT_WHERE_USED_RESULT,
    },
  });
}

/**
 * Get where-used references with parsed results
 *
 * This is a convenience method that combines scope fetching, search execution,
 * and XML parsing into a single call with structured output.
 *
 * @param connection - ABAP connection
 * @param params - Where-used list parameters
 * @returns Parsed where-used results with references list
 *
 * @example
 * ```typescript
 * // Search every object type (Eclipse 'select all') — may return many results
 * const all = await getWhereUsedList(connection, {
 *   object_name: 'ZMY_TABLE',
 *   object_type: 'table',
 *   enableAllTypes: true
 * });
 *
 * // Or restrict to just the types you care about (e.g. only structures/tables),
 * // so SAP never searches — and never returns — hundreds of classes.
 * const structuresOnly = await getWhereUsedList(connection, {
 *   object_name: 'ZMY_TABLE',
 *   object_type: 'table',
 *   enableOnlyTypes: ['TABL/DS', 'TABL/DT']
 * });
 *
 * console.log(`Found ${structuresOnly.totalReferences} references`);
 * for (const ref of structuresOnly.references) {
 *   console.log(`${ref.name} (${ref.type}) in package ${ref.packageName}`);
 * }
 * ```
 */
export async function getWhereUsedList(
  connection: IAbapConnection,
  params: IGetWhereUsedListParams,
): Promise<IWhereUsedListResult> {
  if (!params.object_name) {
    throw new Error('Object name is required');
  }
  if (!params.object_type) {
    throw new Error('Object type is required');
  }

  let scopeXml: string | undefined;
  // Set when the /usageReferences/scope sub-resource is unavailable and we fell
  // back to an unscoped search. The requested type filter could not be applied
  // server-side, so it is applied to the parsed references instead (below).
  let scopeUnavailable = false;

  // Fetch and modify the scope only when the caller wants to constrain which
  // object types are searched. Otherwise getWhereUsed() falls back to SAP's
  // default scope.
  const enableOnly = params.enableOnlyTypes?.length
    ? params.enableOnlyTypes
    : undefined;
  const disable = params.disableTypes?.length ? params.disableTypes : undefined;

  if (params.enableAllTypes || enableOnly || disable) {
    try {
      const scopeResponse = await getWhereUsedScope(connection, {
        object_name: params.object_name,
        object_type: params.object_type,
      });

      // enableOnly wins over enableAll; disable is then applied on top so callers
      // can both narrow to a set and prune one of those, in a single pass.
      let modified = scopeResponse.data;
      if (enableOnly) {
        modified = modifyWhereUsedScope(modified, { enableOnly });
      } else if (params.enableAllTypes) {
        modified = modifyWhereUsedScope(modified, { enableAll: true });
      }
      if (disable) {
        modified = modifyWhereUsedScope(modified, { disable });
      }
      scopeXml = modified;
    } catch (error) {
      // The /usageReferences/scope sub-resource is not exposed on every system
      // (some S/4 releases answer 404 "No suitable resource found"). Server-side
      // type filtering is then impossible, so fall back to an unscoped search —
      // SAP's default scope, exactly what the Eclipse ADT client sends — and let
      // the caller filter the references client-side. Only the missing-resource
      // case is swallowed; anything else (auth, network, 5xx) is re-thrown.
      if (!isScopeResourceUnavailable(error)) throw error;
      scopeXml = undefined;
      scopeUnavailable = true;
    }
  }

  // Execute where-used search
  const response = await getWhereUsed(connection, {
    object_name: params.object_name,
    object_type: params.object_type,
    scopeXml,
  });

  const xml: string = response.data;

  // Parse XML response
  const parsed = xmlParser.parse(xml);
  const root = parsed['usagereferences:usageReferenceResult'];

  if (!root) {
    return {
      objectName: params.object_name,
      objectType: params.object_type,
      totalReferences: 0,
      resultDescription: '',
      references: [],
      rawXml: params.includeRawXml ? xml : undefined,
    };
  }

  const numberOfResults = parseInt(root['@_numberOfResults'] || '0', 10);
  const resultDescription = root['@_resultDescription'] || '';

  // Parse referenced objects
  const references: IWhereUsedReference[] = [];
  const referencedObjectsNode = root['usagereferences:referencedObjects'];

  if (referencedObjectsNode) {
    const refObjects =
      referencedObjectsNode['usagereferences:referencedObject'];
    const refArray = Array.isArray(refObjects)
      ? refObjects
      : refObjects
        ? [refObjects]
        : [];

    for (const refObj of refArray) {
      const adtObject = refObj['usagereferences:adtObject'];
      if (!adtObject) continue;

      // Skip packages (DEVC/K) - they are container nodes, not actual references
      const objType = adtObject['@_adtcore:type'] || '';
      if (objType === 'DEVC/K') continue;

      const packageRef = adtObject['adtcore:packageRef'];

      references.push({
        uri: refObj['@_uri'] || '',
        name: adtObject['@_adtcore:name'] || '',
        type: objType,
        parentUri: refObj['@_parentUri'],
        packageName: packageRef?.['@_adtcore:name'],
        responsible: adtObject['@_adtcore:responsible'],
        isResult: refObj['@_isResult'] === 'true',
        usageInformation: refObj['@_usageInformation'],
        objectIdentifier: refObj.objectIdentifier,
      });
    }
  }

  // When server-side scoping was unavailable, the search ran unscoped and the
  // parsed list holds every reference type (potentially thousands). Apply the
  // requested type filter here so callers receive the same narrowed set they
  // would have gotten from a server-side scope — the SAP round-trip cannot be
  // avoided on such systems, but the result handed back (and ultimately the
  // load on the consumer/LLM) is reduced to the types actually asked for.
  let resultRefs = references;
  if (scopeUnavailable && (enableOnly || disable)) {
    if (enableOnly) {
      const allow = new Set(enableOnly);
      resultRefs = resultRefs.filter((r) => allow.has(r.type));
    }
    if (disable) {
      const deny = new Set(disable);
      resultRefs = resultRefs.filter((r) => !deny.has(r.type));
    }
  }

  return {
    objectName: params.object_name,
    objectType: params.object_type,
    // After a client-side narrow the server's numberOfResults no longer matches
    // what we return, so report the size of the references actually handed back.
    totalReferences:
      scopeUnavailable && (enableOnly || disable)
        ? resultRefs.length
        : numberOfResults,
    resultDescription,
    references: resultRefs,
    rawXml: params.includeRawXml ? xml : undefined,
  };
}
