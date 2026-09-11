/**
 * Package update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields (abapLanguageVersion, etc.)
 * that would be lost if XML were built from scratch.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  IUpdatePackageParams,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_PACKAGE, CT_PACKAGE } from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  limitDescription,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import {
  extractXmlString,
  patchIf,
  patchXmlAttribute,
  patchXmlElementAttribute,
} from '../../utils/xmlPatch';

/**
 * Patch current package XML with updated values.
 * Only modifies fields that are explicitly provided in args.
 */
function patchPackageXml(
  currentXml: string,
  args: IUpdatePackageParams,
): string {
  let xml = currentXml;

  // Read-modify-write: empty string means "don't change" — preserve value from GET.
  // Only non-empty values are patched into the XML.

  // Description (always provided for update)
  if (args.description) {
    const description = limitDescription(args.description);
    xml = patchXmlAttribute(xml, 'adtcore:description', description);
  }

  // Responsible
  xml = patchIf(xml, args.responsible || undefined, (x, val) =>
    patchXmlAttribute(x, 'adtcore:responsible', val),
  );

  // Master system
  xml = patchIf(xml, args.master_system || undefined, (x, val) =>
    patchXmlAttribute(x, 'adtcore:masterSystem', val),
  );

  // Package type (pak:packageType attribute on pak:attributes element)
  xml = patchIf(xml, args.package_type || undefined, (x, val) =>
    patchXmlElementAttribute(x, 'pak:attributes', 'pak:packageType', val),
  );

  // Record changes
  if (args.record_changes !== undefined) {
    xml = patchXmlElementAttribute(
      xml,
      'pak:attributes',
      'pak:recordChanges',
      args.record_changes ? 'true' : 'false',
    );
  }

  // Super package
  xml = patchIf(xml, args.super_package || undefined, (x, val) =>
    patchXmlElementAttribute(x, 'pak:superPackage', 'adtcore:name', val),
  );

  // Software component
  xml = patchIf(xml, args.software_component || undefined, (x, val) =>
    patchXmlElementAttribute(x, 'pak:softwareComponent', 'pak:name', val),
  );

  // Transport layer
  xml = patchIf(xml, args.transport_layer || undefined, (x, val) =>
    patchXmlElementAttribute(x, 'pak:transportLayer', 'pak:name', val),
  );

  return xml;
}

/**
 * Write the document the caller built.
 *
 * **One request.** This used to GET the current document, patch the named
 * fields into it, and PUT the result — two requests in one member, and a merge
 * whose rules nobody outside could change. A caller reads the document with the
 * member that reads it, edits it, and passes it here, which is also where the
 * guarantee that it is valid belongs.
 *
 * A field left out of `document` is not preserved: nothing was read to preserve
 * it from.
 */
export async function updatePackage(
  connection: IAbapConnection,
  params: IUpdatePackageParams,
  document: string,
  lockHandle: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(params.package_name.toLowerCase());
  const corrNrParam = params.transport_request
    ? `&corrNr=${params.transport_request}`
    : '';
  const url = `/sap/bc/adt/packages/${encodedName}?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: { 'Content-Type': CT_PACKAGE, Accept: ACCEPT_PACKAGE },
  });
}
