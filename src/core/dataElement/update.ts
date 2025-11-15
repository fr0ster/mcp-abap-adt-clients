/**
 * DataElement update operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId, makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { lockDataElement } from './lock';
import { unlockDataElement } from './unlock';
import { activateDataElement } from './activation';
import { UpdateDataElementParams } from './types';

/**
 * Get domain info to extract dataType, length, decimals
 */
async function getDomainInfo(
  connection: AbapConnection,
  domainName: string
): Promise<{ dataType: string; length: number; decimals: number }> {
  const baseUrl = await connection.getBaseUrl();
  const domainNameEncoded = encodeSapObjectName(domainName.toLowerCase());
  const url = `${baseUrl}/sap/bc/adt/ddic/domains/${domainNameEncoded}`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.domains.v1+xml, application/vnd.sap.adt.domains.v2+xml'
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: ''
  });

  const result = parser.parse(response.data);
  const domainXml = result['doma:domain'];

  return {
    dataType: domainXml['doma:content']?.['doma:typeInformation']?.['doma:datatype'] || 'CHAR',
    length: domainXml['doma:content']?.['doma:typeInformation']?.['doma:length'] || 100,
    decimals: domainXml['doma:content']?.['doma:typeInformation']?.['doma:decimals'] || 0
  };
}

/**
 * Get data element to verify update
 */
async function getDataElementForVerification(
  connection: AbapConnection,
  dataElementName: string,
  sessionId: string
): Promise<any> {
  const baseUrl = await connection.getBaseUrl();
  const dataElementNameEncoded = encodeSapObjectName(dataElementName.toLowerCase());
  const url = `${baseUrl}/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const result = parser.parse(response.data);
  return result['blue:wbobj'];
}

/**
 * Update data element with new data
 */
async function updateDataElementInternal(
  connection: AbapConnection,
  args: UpdateDataElementParams,
  lockHandle: string,
  sessionId: string,
  username: string,
  domainInfo: { dataType: string; length: number; decimals: number }
): Promise<AxiosResponse> {
  const dataElementNameEncoded = encodeSapObjectName(args.data_element_name.toLowerCase());

  const corrNrParam = args.transport_request ? `&corrNr=${args.transport_request}` : '';
  const url = `/sap/bc/adt/ddic/dataelements/${dataElementNameEncoded}?lockHandle=${lockHandle}${corrNrParam}`;

  const typeKind = args.type_kind || 'domain';
  const typeName = args.type_name || args.domain_name || '';

  let dataType = '';
  let dataTypeLength = 0;
  let dataTypeDecimals = 0;

  if (typeKind === 'domain') {
    dataType = domainInfo.dataType;
    dataTypeLength = domainInfo.length;
    dataTypeDecimals = domainInfo.decimals;
  } else if (typeKind === 'builtin') {
    dataType = args.data_type || 'CHAR';
    dataTypeLength = args.length || 100;
    dataTypeDecimals = args.decimals || 0;
  } else {
    dataType = '';
    dataTypeLength = 0;
    dataTypeDecimals = 0;
  }

  const shortMaxLength = 10;
  const mediumMaxLength = 20;
  const longMaxLength = 40;
  const headingMaxLength = 55;

  const shortLabel = (args.short_label || '').substring(0, shortMaxLength);
  const mediumLabel = (args.medium_label || '').substring(0, mediumMaxLength);
  const longLabel = (args.long_label || '').substring(0, longMaxLength);
  const headingLabel = (args.heading_label || '').substring(0, headingMaxLength);

  const shortLength = shortLabel.length || shortMaxLength;
  const mediumLength = mediumLabel.length || mediumMaxLength;
  const longLength = longLabel.length || longMaxLength;
  const headingLength = headingLabel.length || headingMaxLength;

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<blue:wbobj xmlns:blue="http://www.sap.com/wbobj/dictionary/dtel"
            xmlns:adtcore="http://www.sap.com/adt/core"
            xmlns:atom="http://www.w3.org/2005/Atom"
            xmlns:dtel="http://www.sap.com/adt/dictionary/dataelements"
            adtcore:description="${args.description || args.data_element_name}"
            adtcore:language="EN"
            adtcore:name="${args.data_element_name.toUpperCase()}"
            adtcore:type="DTEL/DE"
            adtcore:masterLanguage="EN"
            adtcore:responsible="${username}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
  <dtel:dataElement>
    <dtel:typeKind>${typeKind}</dtel:typeKind>
    <dtel:typeName>${typeName.toUpperCase()}</dtel:typeName>
    <dtel:dataType>${dataType}</dtel:dataType>
    <dtel:dataTypeLength>${dataTypeLength}</dtel:dataTypeLength>
    <dtel:dataTypeDecimals>${dataTypeDecimals}</dtel:dataTypeDecimals>
    <dtel:shortFieldLabel>${shortLabel}</dtel:shortFieldLabel>
    <dtel:shortFieldLength>${shortLength}</dtel:shortFieldLength>
    <dtel:shortFieldMaxLength>${shortMaxLength}</dtel:shortFieldMaxLength>
    <dtel:mediumFieldLabel>${mediumLabel}</dtel:mediumFieldLabel>
    <dtel:mediumFieldLength>${mediumLength}</dtel:mediumFieldLength>
    <dtel:mediumFieldMaxLength>${mediumMaxLength}</dtel:mediumFieldMaxLength>
    <dtel:longFieldLabel>${longLabel}</dtel:longFieldLabel>
    <dtel:longFieldLength>${longLength}</dtel:longFieldLength>
    <dtel:longFieldMaxLength>${longMaxLength}</dtel:longFieldMaxLength>
    <dtel:headingFieldLabel>${headingLabel}</dtel:headingFieldLabel>
    <dtel:headingFieldLength>${headingLength}</dtel:headingFieldLength>
    <dtel:headingFieldMaxLength>${headingMaxLength}</dtel:headingFieldMaxLength>
  </dtel:dataElement>
</blue:wbobj>`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.sap.adt.dataelements.v1+xml, application/vnd.sap.adt.dataelements.v2+xml',
    'Content-Type': 'application/vnd.sap.adt.dataelements.v2+xml; charset=utf-8'
  };

  return makeAdtRequestWithSession(connection, url, 'PUT', sessionId, xmlBody, headers);
}

/**
 * Update ABAP data element
 * Full workflow: get domain info -> lock -> update -> unlock -> activate
 */
export async function updateDataElement(
  connection: AbapConnection,
  params: UpdateDataElementParams
): Promise<AxiosResponse> {
  if (!params.data_element_name) {
    throw new Error('Data element name is required');
  }
  if (!params.package_name) {
    throw new Error('Package name is required');
  }

  const sessionId = generateSessionId();
  const username = process.env.SAP_USER || process.env.SAP_USERNAME || 'MPCUSER';
  let lockHandle = '';

  try {
    const typeKind = params.type_kind || 'domain';
    let domainInfo = { dataType: 'CHAR', length: 100, decimals: 0 };

    if (typeKind === 'domain') {
      const domainName = params.type_name || params.domain_name || 'CHAR100';
      domainInfo = await getDomainInfo(connection, domainName);
    }

    lockHandle = await lockDataElement(connection, params.data_element_name, sessionId);

    await new Promise(resolve => setTimeout(resolve, 500));

    await updateDataElementInternal(connection, params, lockHandle, sessionId, username, domainInfo);

    await unlockDataElement(connection, params.data_element_name, lockHandle, sessionId);

    const shouldActivate = params.activate !== false;
    if (shouldActivate) {
      await activateDataElement(connection, params.data_element_name, sessionId);
    }

    const updatedDataElement = await getDataElementForVerification(connection, params.data_element_name, sessionId);

    return {
      data: {
        success: true,
        data_element_name: params.data_element_name,
        package: params.package_name,
        transport_request: params.transport_request,
        domain_name: params.domain_name,
        status: shouldActivate ? 'active' : 'inactive',
        session_id: sessionId,
        message: `Data element ${params.data_element_name} updated${shouldActivate ? ' and activated' : ''} successfully`,
        data_element_details: updatedDataElement
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    if (lockHandle) {
      try {
        await unlockDataElement(connection, params.data_element_name, lockHandle, sessionId);
      } catch (unlockError) {
        // Ignore unlock errors
      }
    }
    throw error;
  }
}

