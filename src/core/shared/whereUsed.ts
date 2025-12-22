/**
 * Where-used operations for ABAP objects
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IGetWhereUsedParams, IGetWhereUsedScopeParams } from './types';

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
  let result = scopeXml;

  if (options.enableAll) {
    // Enable all object types
    result = result.replace(/isSelected="false"/g, 'isSelected="true"');
  } else if (options.enableOnly) {
    // First disable all, then enable only specified
    result = result.replace(/isSelected="true"/g, 'isSelected="false"');
    for (const typeName of options.enableOnly) {
      const typeRegex = new RegExp(
        `(<usagereferences:type[^>]*name="${typeName.replace(/\//g, '\\/')})"[^>]*(isSelected=)"false"`,
        'g',
      );
      result = result.replace(typeRegex, '$1 $2"true"');
    }
  } else {
    // Enable specific types (keep existing selections)
    if (options.enable) {
      for (const typeName of options.enable) {
        const typeRegex = new RegExp(
          `(<usagereferences:type[^>]*name="${typeName.replace(/\//g, '\\/')})"[^>]*(isSelected=)"false"`,
          'g',
        );
        result = result.replace(typeRegex, '$1 $2"true"');
      }
    }
    // Disable specific types
    if (options.disable) {
      for (const typeName of options.disable) {
        const typeRegex = new RegExp(
          `(<usagereferences:type[^>]*name="${typeName.replace(/\//g, '\\/')})"[^>]*(isSelected=)"true"`,
          'g',
        );
        result = result.replace(typeRegex, '$1 $2"false"');
      }
    }
  }

  return result;
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
      'Content-Type':
        'application/vnd.sap.adt.repository.usagereferences.scope.request.v1+xml',
      Accept:
        'application/vnd.sap.adt.repository.usagereferences.scope.response.v1+xml',
    },
  });
}

/**
 * Get where-used references for ABAP object (Step 2 of 2)
 *
 * Eclipse ADT uses a two-step process:
 * 1. GET scope configuration (getWhereUsedScope) - returns available object types
 * 2. POST actual search with scope (this function) - executes search
 *
 * @param connection - ABAP connection
 * @param params - Where-used parameters
 * @param params.scopeXml - Optional scope XML from getWhereUsedScope(). If not provided, will fetch default scope.
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

  // If scope not provided, fetch default scope
  let scopeXml: string = params.scopeXml || '';
  if (!scopeXml) {
    const scopeResponse = await getWhereUsedScope(connection, {
      object_name: params.object_name,
      object_type: params.object_type,
    });
    scopeXml = scopeResponse.data;
  }

  // Step 2: Perform actual where-used search with scope
  const searchUrl = `/sap/bc/adt/repository/informationsystem/usageReferences?uri=${encodeURIComponent(objectUri)}`;

  // Build request body with scope from step 1
  // Extract inner content of usageScopeResult and wrap it in usageReferenceRequest
  const scopeContent = scopeXml
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(
      /<usagereferences:usageScopeResult[^>]*>/,
      '<usagereferences:scope>',
    )
    .replace(
      /<\/usagereferences:usageScopeResult>/,
      '</usagereferences:scope>',
    );

  const searchRequestBody = `<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageReferenceRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:affectedObjects/>${scopeContent}</usagereferences:usageReferenceRequest>`;

  return connection.makeAdtRequest({
    url: searchUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: searchRequestBody,
    headers: {
      'Content-Type':
        'application/vnd.sap.adt.repository.usagereferences.request.v1+xml',
      Accept:
        'application/vnd.sap.adt.repository.usagereferences.result.v1+xml',
    },
  });
}
