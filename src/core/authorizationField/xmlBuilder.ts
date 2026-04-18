/**
 * Shared XML helpers for authorization field (SUSO / AUTH) payloads.
 *
 * The auth envelope is `auth:authorizationField` with an inline `auth:content`
 * block. Create and update share the same root element but differ only in
 * whether the URL carries a lockHandle — so the XML builder is shared.
 */

import { limitDescription } from '../../utils/internalUtils';
import type { ICreateAuthorizationFieldParams } from './types';

/**
 * Escape XML-significant characters in attribute values / text content.
 * Attributes may contain double quotes, hence the "&quot;" replacement.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a single `<auth:tag>value</auth:tag>` line, omitted when value is
 * undefined or empty — the server rejects empty element overrides for
 * unspecified fields.
 */
function tag(name: string, value: string | undefined): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return `    <auth:${name}>${escapeXml(String(value))}</auth:${name}>\n`;
}

/**
 * Build the root XML body for create/update.
 */
export function buildAuthorizationFieldXml(
  args: ICreateAuthorizationFieldParams,
): string {
  const description = escapeXml(
    limitDescription(args.description || args.authorization_field_name),
  );
  const name = args.authorization_field_name.toUpperCase();
  const pkg = (args.package_name || '').toUpperCase();
  const masterSystemAttr = args.master_system
    ? ` adtcore:masterSystem="${escapeXml(args.master_system)}"`
    : '';
  const responsibleAttr = args.responsible
    ? ` adtcore:responsible="${escapeXml(args.responsible)}"`
    : '';

  const content =
    tag('fieldName', args.field_name) +
    tag('rollName', args.roll_name) +
    tag('checkTable', args.check_table) +
    tag('exitFB', args.exit_fb) +
    tag('abap_language_version', args.abap_language_version) +
    tag('search', args.search) +
    tag('objexit', args.objexit) +
    tag('domname', args.domname) +
    tag('outputlen', args.outputlen) +
    tag('convexit', args.convexit) +
    tag('orglvlinfo', args.orglvlinfo) +
    tag('col_searchhelp', args.col_searchhelp) +
    tag('col_searchhelp_name', args.col_searchhelp_name) +
    tag('col_searchhelp_descr', args.col_searchhelp_descr);

  return `<?xml version="1.0" encoding="UTF-8"?>
<auth:authorizationField xmlns:auth="http://www.sap.com/iam/auth" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="${escapeXml(name)}" adtcore:type="AUTH" adtcore:description="${description}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${escapeXml(pkg)}"/>
  <auth:content>
${content}  </auth:content>
</auth:authorizationField>`;
}
