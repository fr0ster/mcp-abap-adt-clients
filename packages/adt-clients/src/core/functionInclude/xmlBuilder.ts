/**
 * Shared XML helpers for function include (FUGR/I) metadata payloads.
 *
 * Create and update share the same root element and differ only in whether
 * the URL carries a lockHandle, so the XML builder is shared.
 *
 * Note: language / masterLanguage / masterSystem / responsible are inherited
 * from the parent function group and must NOT appear in the include payload.
 */

import { TYPE_CODE } from '../../constants/typeCodes';
import { FUNCTION_GROUP } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateFunctionIncludeParams } from './types';

/**
 * Build metadata XML body for create (POST) and update (PUT).
 * The parent group is referenced via adtcore:containerRef (NOT packageRef).
 */
export function buildFunctionIncludeXml(
  args: ICreateFunctionIncludeParams,
): string {
  const name = args.include_name.toUpperCase();
  const groupUpper = args.function_group_name.toUpperCase();
  const description = escapeXmlAttr(
    limitDescription(args.description || args.include_name),
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<finclude:abapFunctionGroupInclude xmlns:finclude="http://www.sap.com/adt/functions/fincludes" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="${escapeXmlAttr(name)}" adtcore:type="${TYPE_CODE.functionInclude}" adtcore:description="${description}">
  <adtcore:containerRef adtcore:uri="${escapeXmlAttr(FUNCTION_GROUP.uri(args.function_group_name))}" adtcore:type="${TYPE_CODE.functionGroup}" adtcore:name="${escapeXmlAttr(groupUpper)}"/>
</finclude:abapFunctionGroupInclude>`;
}
