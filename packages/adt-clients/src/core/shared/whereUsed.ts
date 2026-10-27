/**
 * Where-used operations for ABAP objects
 */

import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtAddressableCode } from '../../endpoints/codes';
import { buildObjectUri } from '../../utils/activationUtils';
import { requestHeaders } from '../../utils/requestHeaders';
import type { IGetWhereUsedParams, IGetWhereUsedScopeParams } from './types';

/**
 * Modify where-used scope to enable/disable specific object types
 *
 * @param scopeXml - Scope XML from getWhereUsedScope()
 * @param options - Modification options
 * @returns Modified scope XML
 *
 * @example
 * const scopeResponse = await getWhereUsedScope(connection, { object_name: 'ZMY_CLASS', object_type: 'CLAS/OC' });
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
  // Each available type is a self-closing <ns:type .../> tag. The namespace
  // PREFIX is system-dependent (usagereferences: vs usageReferences:), so match
  // any prefix — hard-coding one made the rewrite a silent no-op on the other.
  // We rewrite ONLY the isSelected attribute per tag and never touch the opaque
  // <ns:payload> blob or attribute ordering — SAP emits attributes as
  // `isDefault isSelected name`, so logic must read `name` wherever it appears,
  // not assume it precedes isSelected.
  const typeTagRegex = /<[A-Za-z][\w-]*:type\b[^>]*?\/>/g;

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
 * Set the isSelected attribute on a single <ns:type> tag, inserting it if
 * absent. Leaves all other attributes and their order intact. The namespace
 * prefix is matched (and preserved) rather than hard-coded.
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
    /<([A-Za-z][\w-]*:type)\b/,
    `<$1 isSelected="${value}"`,
  );
}

/**
 * What where-used addresses: every addressable code but a function include,
 * whose group the parameters have no field for (`FUGR/FF` names its group as
 * `GROUP|FM`). `VIEW/DV` included, as before 38.0.0.
 */
export type WhereUsedAddressCode = Exclude<AdtAddressableCode, 'FUGR/I'>;

/** What the where-used requests take: their params, `object_type` addressable. */
export type IWhereUsedScopeRequest = Omit<
  IGetWhereUsedScopeParams,
  'object_type'
> & { object_type: WhereUsedAddressCode };
export type IWhereUsedRequest = Omit<IGetWhereUsedParams, 'object_type'> & {
  object_type: WhereUsedAddressCode;
};

/**
 * The address a where-used request asks about.
 *
 * `objectType` is a code of the ADT type tables (`CLAS/OC`, `BDEF/BDO`, …).
 * The friendly names this used to accept beside the codes (`class`,
 * `structure`, …) went with interfaces-adt 21.0.0, whose `object_type` is an
 * `AdtTypeCode`: one of them, `structure`, mapped to `STRU/DS`, a code no
 * release lists. A function module is named `GROUP|FM`, because the
 * parameters carry no separate group.
 *
 * Throws for a function module without its group — the caller's argument,
 * found before any request is made.
 */
export function whereUsedObjectUri(
  objectName: string,
  objectType: WhereUsedAddressCode,
): string {
  if (objectType === 'FUGR/FF') {
    const [group, fm] = objectName.split('|');
    if (!group || !fm) {
      throw new Error(
        `A function module is named GROUP|FM_NAME for where-used; got ${objectName}`,
      );
    }
    return buildObjectUri(fm, objectType, group);
  }
  return buildObjectUri(objectName, objectType);
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
 *   object_type: 'CLAS/OC'
 * });
 *
 * // Modify scope XML to select/deselect object types
 * let scopeXml = scopeResponse.data;
 * scopeXml = scopeXml.replace(/name="FUGR\/FF" isSelected="false"/, 'name="FUGR/FF" isSelected="true"');
 *
 * // Step 2: Execute search with modified scope
 * const result = await getWhereUsed(connection, {
 *   object_name: 'ZMY_CLASS',
 *   object_type: 'CLAS/OC',
 *   scopeXml: scopeXml
 * });
 */
export async function getWhereUsedScope(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  params: IWhereUsedScopeRequest,
): Promise<IAdtWireResponse> {
  const objectUri = whereUsedObjectUri(params.object_name, params.object_type);
  const scopeUrl = `/sap/bc/adt/repository/informationsystem/usageReferences/scope?uri=${encodeURIComponent(objectUri)}`;
  const scopeRequestBody =
    '<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageScopeRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:affectedObjects/></usagereferences:usageScopeRequest>';

  return connection.makeAdtRequest({
    url: scopeUrl,
    method: 'POST',
    timeout: 0,
    data: scopeRequestBody,
    headers: requestHeaders(headers),
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
  headers: IAdtHeaders,
  params: IWhereUsedRequest,
): Promise<IAdtWireResponse> {
  const objectUri = whereUsedObjectUri(params.object_name, params.object_type);

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
  // re-wrap it as <ns:scope>. The namespace prefix is system-dependent
  // (usagereferences: vs usageReferences:), so capture and reuse it, and KEEP the
  // open tag's attributes ($2, i.e. the xmlns declaration) on <scope> so the
  // re-wrapped element stays namespace-bound regardless of which prefix SAP used.
  const scopeContent = params.scopeXml
    ? params.scopeXml
        .replace(/<\?xml[^>]*\?>/, '')
        .replace(/<([A-Za-z][\w-]*):usageScopeResult\b([^>]*)>/, '<$1:scope$2>')
        .replace(/<\/([A-Za-z][\w-]*):usageScopeResult>/, '</$1:scope>')
    : '';

  const searchRequestBody = `<?xml version="1.0" encoding="UTF-8"?><usagereferences:usageReferenceRequest xmlns:usagereferences="http://www.sap.com/adt/ris/usageReferences"><usagereferences:affectedObjects/>${scopeContent}</usagereferences:usageReferenceRequest>`;

  return connection.makeAdtRequest({
    url: searchUrl,
    method: 'POST',
    timeout: 0,
    data: searchRequestBody,
    headers: requestHeaders(headers),
  });
}
