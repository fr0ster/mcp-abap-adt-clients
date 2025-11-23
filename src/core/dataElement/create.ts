/**
 * DataElement create operations - Low-level functions
 * NOTE: Builder should call connection.setSessionType("stateful") before creating
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getDomainInfo } from './update';
import { CreateDataElementParams } from './types';

/**
 * Low-level: Create data element (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: AbapConnection,
  args: CreateDataElementParams
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/dataelements${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  // Get system information for cloud systems
  const systemInfo = await getSystemInformation(connection);
  const username = systemInfo?.userName || '';
  const masterSystem = systemInfo?.systemID || '';

  const description = args.description || args.data_element_name;
  if (!args.type_kind) {
    throw new Error('type_kind is required. Must be one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType');
  }
  const requestedTypeKind = args.type_kind;
  // Use requestedTypeKind directly for XML (it's already one of: domain, predefinedAbapType, refToPredefinedAbapType, refToDictionaryType, refToClifType)
  const typeKindXml = requestedTypeKind;

  // Determine typeName based on typeKind
  let typeName = '';
  if (requestedTypeKind === 'domain') {
    typeName = (args.domain_name || args.type_name || '').toUpperCase();
  } else if (requestedTypeKind === 'predefinedAbapType' || requestedTypeKind === 'refToPredefinedAbapType') {
    // For predefinedAbapType and refToPredefinedAbapType, typeName is empty
    typeName = '';
  } else if (requestedTypeKind === 'refToDictionaryType' || requestedTypeKind === 'refToClifType') {
    // For refToDictionaryType and refToClifType, type_name is required
    typeName = (args.type_name || '').toUpperCase();
  }

  // Get dataType, length, decimals based on typeKind
  let dataType = '';
  let length = 0;
  let decimals = 0;

  if (requestedTypeKind === 'domain') {
    // For domain type, get information from the domain
    const domainName = (args.domain_name || args.type_name || '').toUpperCase();
    if (domainName) {
      try {
        const domainInfo = await getDomainInfo(connection, domainName);
        dataType = domainInfo.dataType;
        length = domainInfo.length;
        decimals = domainInfo.decimals;
      } catch (error: any) {
        // If domain info cannot be retrieved, use defaults
        dataType = 'CHAR';
        length = 100;
        decimals = 0;
      }
    } else {
      dataType = 'CHAR';
      length = 100;
      decimals = 0;
    }
  } else if (requestedTypeKind === 'predefinedAbapType' || requestedTypeKind === 'refToPredefinedAbapType') {
    // For predefinedAbapType and refToPredefinedAbapType, use provided values
    dataType = args.data_type || 'CHAR';
    length = args.length || 100;
    decimals = args.decimals || 0;
  } else {
    // For refToDictionaryType and refToClifType, dataType is empty, length/decimals are 0
    dataType = '';
    length = 0;
    decimals = 0;
  }

  const shortLabel = args.short_label || '';
  const mediumLabel = args.medium_label || '';
  const longLabel = args.long_label || '';
  const headingLabel = args.heading_label || '';
  const searchHelp = args.search_help !== undefined ? args.search_help : '';
  const searchHelpParameter = args.search_help_parameter !== undefined ? args.search_help_parameter : '';
  const setGetParameter = args.set_get_parameter !== undefined ? args.set_get_parameter : '';
  const defaultComponentName = args.default_component_name !== undefined ? args.default_component_name : '';
  const deactivateInputHistory = args.deactivate_input_history !== undefined ? args.deactivate_input_history : false;
  const changeDocument = args.change_document !== undefined ? args.change_document : false;
  const leftToRightDirection = args.left_to_right_direction !== undefined ? args.left_to_right_direction : false;
  const deactivateBIDIFiltering = args.deactivate_bidi_filtering !== undefined ? args.deactivate_bidi_filtering : false;

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';
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
    'Accept': 'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.dataelements.v2+xml'
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers
  });
}