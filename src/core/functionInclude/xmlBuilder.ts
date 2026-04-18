/**
 * Shared XML helpers for function include (FUGR/I) metadata payloads.
 *
 * Create and update share the same root element and differ only in whether
 * the URL carries a lockHandle, so the XML builder is shared.
 *
 * Note: language / masterLanguage / masterSystem / responsible are inherited
 * from the parent function group and must NOT appear in the include payload.
 */

import { limitDescription } from '../../utils/internalUtils';
import type { ICreateFunctionIncludeParams } from './types';

/**
 * Escape XML-significant characters in attribute values / text content.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build metadata XML body for create (POST) and update (PUT).
 * The parent group is referenced via adtcore:containerRef (NOT packageRef).
 */
export function buildFunctionIncludeXml(
  args: ICreateFunctionIncludeParams,
): string {
  const name = args.include_name.toUpperCase();
  const groupUpper = args.function_group_name.toUpperCase();
  const groupLower = args.function_group_name.toLowerCase();
  const description = escapeXml(
    limitDescription(args.description || args.include_name),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<finclude:abapFunctionGroupInclude xmlns:finclude="http://www.sap.com/adt/functions/fincludes" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="${escapeXml(name)}" adtcore:type="FUGR/I" adtcore:description="${description}">
  <adtcore:containerRef adtcore:uri="/sap/bc/adt/functions/groups/${escapeXml(groupLower)}" adtcore:type="FUGR/F" adtcore:name="${escapeXml(groupUpper)}"/>
</finclude:abapFunctionGroupInclude>`;
}
