/**
 * DataElement update operations
 *
 * Uses read-modify-write pattern: GET current XML → patch fields → PUT.
 * This preserves all SAP-managed fields that would be lost if XML were built from scratch.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DATA_ELEMENT,
  ACCEPT_DOMAIN,
} from '../../constants/contentTypes';
import {
  encodeSapObjectName,
  limitDescription,
  writeQuery,
} from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import {
  extractXmlString,
  patchIf,
  patchXmlAttribute,
  patchXmlElement,
} from '../../utils/xmlPatch';
import type { IUpdateDataElementParams } from './types';

const debugEnabled = process.env.DEBUG_ADT_LIBS === 'true';

/**
 * Get domain info to extract dataType, length, decimals
 */
export async function getDomainInfo(
  connection: IAbapConnection,
  domainName: string,
): Promise<{ dataType: string; length: number; decimals: number }> {
  const { XMLParser } = await import('fast-xml-parser');
  const domainNameEncoded = encodeSapObjectName(domainName.toLowerCase());
  const url = `/sap/bc/adt/ddic/domains/${domainNameEncoded}`;

  const headers = {
    Accept: ACCEPT_DOMAIN,
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers,
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const result = parser.parse(response.data);
  const domainXml = result['doma:domain'];

  return {
    dataType:
      domainXml['doma:content']?.['doma:typeInformation']?.['doma:datatype'] ||
      'CHAR',
    length:
      domainXml['doma:content']?.['doma:typeInformation']?.['doma:length'] ||
      100,
    decimals:
      domainXml['doma:content']?.['doma:typeInformation']?.['doma:decimals'] ||
      0,
  };
}

/**
 * Patch current data element XML with updated values.
 * Only modifies fields that are explicitly provided in args.
 */
function patchDataElementXml(
  currentXml: string,
  args: IUpdateDataElementParams,
): string {
  let xml = currentXml;

  // Description
  if (args.description) {
    const description = limitDescription(args.description);
    xml = patchXmlAttribute(xml, 'adtcore:description', description);
  }

  // Type information
  xml = patchIf(xml, args.type_kind, (x, val) =>
    patchXmlElement(x, 'dtel:typeKind', val),
  );

  // typeName — handle domain type: use type_name or data_type as domain name
  if (args.type_kind || args.type_name || args.data_type) {
    let typeName = '';
    if (args.type_kind === 'domain') {
      typeName = (args.type_name || args.data_type || '').toUpperCase();
    } else if (args.type_name) {
      typeName = args.type_name.toUpperCase();
    }
    if (typeName) {
      xml = patchXmlElement(xml, 'dtel:typeName', typeName);
    }
  }

  xml = patchIf(xml, args.data_type, (x, val) =>
    patchXmlElement(x, 'dtel:dataType', val),
  );
  xml = patchIf(xml, args.length, (x, val) =>
    patchXmlElement(x, 'dtel:dataTypeLength', String(val).padStart(6, '0')),
  );
  xml = patchIf(xml, args.decimals, (x, val) =>
    patchXmlElement(x, 'dtel:dataTypeDecimals', String(val).padStart(6, '0')),
  );

  // Labels
  if (args.short_label !== undefined) {
    xml = patchXmlElement(xml, 'dtel:shortFieldLabel', args.short_label);
    xml = patchXmlElement(
      xml,
      'dtel:shortFieldLength',
      String(args.short_label.length || 10),
    );
  }
  if (args.medium_label !== undefined) {
    xml = patchXmlElement(xml, 'dtel:mediumFieldLabel', args.medium_label);
    xml = patchXmlElement(
      xml,
      'dtel:mediumFieldLength',
      String(args.medium_label.length || 20),
    );
  }
  if (args.long_label !== undefined) {
    xml = patchXmlElement(xml, 'dtel:longFieldLabel', args.long_label);
    xml = patchXmlElement(
      xml,
      'dtel:longFieldLength',
      String(args.long_label.length || 40),
    );
  }
  if (args.heading_label !== undefined) {
    xml = patchXmlElement(xml, 'dtel:headingFieldLabel', args.heading_label);
    xml = patchXmlElement(
      xml,
      'dtel:headingFieldLength',
      String(args.heading_label.length || 55),
    );
  }

  // Optional fields
  if (args.search_help !== undefined) {
    xml = patchXmlElement(xml, 'dtel:searchHelp', args.search_help);
  }
  if (args.search_help_parameter !== undefined) {
    xml = patchXmlElement(
      xml,
      'dtel:searchHelpParameter',
      args.search_help_parameter,
    );
  }
  if (args.set_get_parameter !== undefined) {
    xml = patchXmlElement(xml, 'dtel:setGetParameter', args.set_get_parameter);
  }
  if (args.default_component_name !== undefined) {
    xml = patchXmlElement(
      xml,
      'dtel:defaultComponentName',
      args.default_component_name,
    );
  }
  if (args.deactivate_input_history !== undefined) {
    xml = patchXmlElement(
      xml,
      'dtel:deactivateInputHistory',
      String(args.deactivate_input_history),
    );
  }
  if (args.change_document !== undefined) {
    xml = patchXmlElement(
      xml,
      'dtel:changeDocument',
      String(args.change_document),
    );
  }
  if (args.left_to_right_direction !== undefined) {
    xml = patchXmlElement(
      xml,
      'dtel:leftToRightDirection',
      String(args.left_to_right_direction),
    );
  }
  if (args.deactivate_bidi_filtering !== undefined) {
    xml = patchXmlElement(
      xml,
      'dtel:deactivateBIDIFiltering',
      String(args.deactivate_bidi_filtering),
    );
  }

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
export async function updateDataElement(
  connection: IAbapConnection,
  params: IUpdateDataElementParams,
  document: string,
  lockHandle?: string,
): Promise<IAdtWireResponse> {
  const encodedName = encodeSapObjectName(
    params.data_element_name.toLowerCase(),
  );
  const url = `/sap/bc/adt/ddic/dataelements/${encodedName}${writeQuery(lockHandle, params.transport_request)}`;

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: document,
    headers: {
      Accept: ACCEPT_DATA_ELEMENT,
      'Content-Type':
        'application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8',
    },
  });
}
