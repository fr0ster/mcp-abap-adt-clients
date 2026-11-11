/**
 * Shared XML helpers for authorization field (SUSO / AUTH) payloads.
 *
 * The auth envelope is `auth:auth` with an inline `auth:content` block — the
 * same root the endpoint returns on a GET. Any other local name in that
 * namespace is rejected with HTTP 500, "System expected the element
 * '{http://www.sap.com/iam/auth}auth'". Create and update share the root and
 * differ only in whether the URL carries a lockHandle, so the builder is shared.
 */

import { limitDescription } from '../../utils/internalUtils';
import { escapeXmlAttr, escapeXmlText } from '../../utils/xml';
import type { ICreateAuthorizationFieldParams } from './types';

/**
 * Build a single `<auth:tag>value</auth:tag>` line, omitted when value is
 * undefined or empty — the server rejects empty element overrides for
 * unspecified fields.
 */
function tag(name: string, value: string | undefined): string {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return `    <auth:${name}>${escapeXmlText(String(value))}</auth:${name}>\n`;
}

/**
 * Build the root XML body for create/update.
 */
export function buildAuthorizationFieldXml(
  args: ICreateAuthorizationFieldParams,
): string {
  const description = escapeXmlAttr(
    limitDescription(args.description || args.authorization_field_name),
  );
  const name = args.authorization_field_name.toUpperCase();
  const pkg = (args.package_name || '').toUpperCase();
  const masterSystemAttr = args.master_system
    ? ` adtcore:masterSystem="${escapeXmlAttr(args.master_system)}"`
    : '';
  const responsibleAttr = args.responsible
    ? ` adtcore:responsible="${escapeXmlAttr(args.responsible)}"`
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
<auth:auth xmlns:auth="http://www.sap.com/iam/auth" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="${escapeXmlAttr(name)}" adtcore:type="AUTH" adtcore:description="${description}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${escapeXmlAttr(pkg)}"/>
  <auth:content>
${content}  </auth:content>
</auth:auth>`;
}
