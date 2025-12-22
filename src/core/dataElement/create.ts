/**
 * DataElement create operations - Low-level functions
 * NOTE: Builder should call connection.setSessionType("stateful") before creating
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import type { AxiosResponse } from 'axios';
import { limitDescription } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateDataElementParams } from './types';

/**
 * Low-level: Create data element (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateDataElementParams,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/dataelements${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  // Get system information for cloud systems
  const systemInfo = await getSystemInformation(connection);
  const username = systemInfo?.userName || '';
  const masterSystem = systemInfo?.systemID || '';

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(
    args.description || args.data_element_name,
  );
  if (!args.type_kind) {
    throw new Error(
      'type_kind is required. Must be one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType',
    );
  }

  // Validate required parameters based on type_kind
  // predefinedAbapType and refToPredefinedAbapType require data_type
  // Other types (domain, refToDictionaryType, refToClifType) require type_name
  if (
    args.type_kind === 'predefinedAbapType' ||
    args.type_kind === 'refToPredefinedAbapType'
  ) {
    if (!args.data_type) {
      throw new Error(
        `data_type is required when type_kind is '${args.type_kind}'. Provide data type (e.g., CHAR, NUMC, INT4).`,
      );
    }
  } else {
    // domain, refToDictionaryType, refToClifType require type_name
    if (args.type_kind === 'domain') {
      // For domain, type_name (domain name) is required, but it will be used as data_type internally
      if (!args.type_name && !args.data_type) {
        throw new Error(
          `type_name (domain name) is required when type_kind is 'domain'. Provide domain name (e.g., ZOK_AUTH_ID).`,
        );
      }
    } else {
      // refToDictionaryType, refToClifType
      if (!args.type_name) {
        throw new Error(
          `type_name is required when type_kind is '${args.type_kind}'. Provide ${args.type_kind === 'refToDictionaryType' ? 'data element name' : 'class name'}.`,
        );
      }
    }
  }

  const typeKindXml = args.type_kind;

  // Use provided values directly - no automatic determination
  // When typeKind is 'domain', dataType should contain the domain name, and it goes to typeName in XML
  let typeName = '';
  if (typeKindXml === 'domain') {
    // For domain type, typeName comes from dataType (or type_name if dataType not provided)
    typeName = (args.data_type || args.type_name || '').toUpperCase();
  } else {
    // For other types, typeName comes from type_name parameter
    typeName = args.type_name ? args.type_name.toUpperCase() : '';
  }
  const dataType = args.data_type || '';
  const length = args.length || 0;
  const decimals = args.decimals || 0;

  const shortLabel = args.short_label || '';
  const mediumLabel = args.medium_label || '';
  const longLabel = args.long_label || '';
  const headingLabel = args.heading_label || '';
  const searchHelp = args.search_help !== undefined ? args.search_help : '';
  const searchHelpParameter =
    args.search_help_parameter !== undefined ? args.search_help_parameter : '';
  const setGetParameter =
    args.set_get_parameter !== undefined ? args.set_get_parameter : '';
  const defaultComponentName =
    args.default_component_name !== undefined
      ? args.default_component_name
      : '';
  const deactivateInputHistory =
    args.deactivate_input_history !== undefined
      ? args.deactivate_input_history
      : false;
  const changeDocument =
    args.change_document !== undefined ? args.change_document : false;
  const leftToRightDirection =
    args.left_to_right_direction !== undefined
      ? args.left_to_right_direction
      : false;
  const deactivateBIDIFiltering =
    args.deactivate_bidi_filtering !== undefined
      ? args.deactivate_bidi_filtering
      : false;

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<blue:wbobj xmlns:blue="http://www.sap.com/wbobj/dictionary/dtel"
            xmlns:adtcore="http://www.sap.com/adt/core"
            xmlns:atom="http://www.w3.org/2005/Atom"
            xmlns:dtel="http://www.sap.com/adt/dictionary/dataelements"
            adtcore:description="${description}"
            adtcore:language="EN"
            adtcore:name="${args.data_element_name.toUpperCase()}"
            adtcore:type="DTEL/DE"
            adtcore:masterLanguage="EN"${masterSystemAttr}
            adtcore:responsible="${username}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
  <dtel:dataElement>
    <dtel:typeKind>${typeKindXml}</dtel:typeKind>
    ${typeName ? `<dtel:typeName>${typeName}</dtel:typeName>` : '<dtel:typeName/>'}
    ${dataType ? `<dtel:dataType>${dataType}</dtel:dataType>` : '<dtel:dataType/>'}
    <dtel:dataTypeLength>${String(length).padStart(6, '0')}</dtel:dataTypeLength>
    <dtel:dataTypeDecimals>${String(decimals).padStart(6, '0')}</dtel:dataTypeDecimals>
    <dtel:shortFieldLabel>${shortLabel}</dtel:shortFieldLabel>
    <dtel:shortFieldLength>10</dtel:shortFieldLength>
    <dtel:shortFieldMaxLength>10</dtel:shortFieldMaxLength>
    <dtel:mediumFieldLabel>${mediumLabel}</dtel:mediumFieldLabel>
    <dtel:mediumFieldLength>20</dtel:mediumFieldLength>
    <dtel:mediumFieldMaxLength>20</dtel:mediumFieldMaxLength>
    <dtel:longFieldLabel>${longLabel}</dtel:longFieldLabel>
    <dtel:longFieldLength>40</dtel:longFieldLength>
    <dtel:longFieldMaxLength>40</dtel:longFieldMaxLength>
    <dtel:headingFieldLabel>${headingLabel}</dtel:headingFieldLabel>
    <dtel:headingFieldLength>55</dtel:headingFieldLength>
    <dtel:headingFieldMaxLength>55</dtel:headingFieldMaxLength>
    ${searchHelp ? `<dtel:searchHelp>${searchHelp}</dtel:searchHelp>` : '<dtel:searchHelp/>'}
    ${searchHelpParameter ? `<dtel:searchHelpParameter>${searchHelpParameter}</dtel:searchHelpParameter>` : '<dtel:searchHelpParameter/>'}
    ${setGetParameter ? `<dtel:setGetParameter>${setGetParameter}</dtel:setGetParameter>` : '<dtel:setGetParameter/>'}
    ${defaultComponentName ? `<dtel:defaultComponentName>${defaultComponentName}</dtel:defaultComponentName>` : '<dtel:defaultComponentName/>'}
    <dtel:deactivateInputHistory>${deactivateInputHistory}</dtel:deactivateInputHistory>
    <dtel:changeDocument>${changeDocument}</dtel:changeDocument>
    <dtel:leftToRightDirection>${leftToRightDirection}</dtel:leftToRightDirection>
    <dtel:deactivateBIDIFiltering>${deactivateBIDIFiltering}</dtel:deactivateBIDIFiltering>
  </dtel:dataElement>
</blue:wbobj>`;

  const headers = {
    Accept:
      'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.dataelements.v2+xml',
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
