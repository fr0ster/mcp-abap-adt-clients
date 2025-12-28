/**
 * TableType update operations
 *
 * Supports two formats:
 * 1. DDL TableType (CDS) - via /source/main endpoint with DDL code
 * 2. Classic DDIC TableType - via XML format with rowType and typeName (like Domain/DataElement)
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  encodeSapObjectName,
  limitDescription,
} from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateTableTypeParams } from './types';

/**
 * Update table type using existing lock/session (AdtDdicTableType workflow)
 * Supports both DDL format (CDS) and XML format (classic DDIC)
 */
export async function updateTableType(
  connection: IAbapConnection,
  params: IUpdateTableTypeParams,
  lockHandle: string,
  logger?: ILogger,
): Promise<AxiosResponse> {
  if (!params.tabletype_name) {
    throw new Error('tabletype_name is required');
  }
  if (!lockHandle) {
    throw new Error('lockHandle is required');
  }

  const tableTypeName = params.tabletype_name.toUpperCase();
  const queryParams = `lockHandle=${lockHandle}${params.transport_request ? `&corrNr=${params.transport_request}` : ''}`;

  // TableType is XML-based entity (like Domain/DataElement), no DDL format
  if (!params.row_type_name) {
    throw new Error('row_type_name is required for TableType update');
  }

  // XML format (classic DDIC TableType) - like Domain/DataElement
  {
    const encodedName = encodeSapObjectName(tableTypeName).toLowerCase();
    const url = `/sap/bc/adt/ddic/tabletypes/${encodedName}?${queryParams}`;

    // Get system information for cloud systems
    const systemInfo = await getSystemInformation(connection);
    const username = systemInfo?.userName || '';
    const systemId = systemInfo?.systemID || '';
    const masterSystem = systemInfo ? systemId : '';
    const responsible = systemInfo ? username : '';

    const masterSystemAttr = masterSystem
      ? ` adtcore:masterSystem="${masterSystem}"`
      : '';
    const responsibleAttr = responsible
      ? ` adtcore:responsible="${responsible}"`
      : '';

    // Description is required for XML format update
    const description = limitDescription(params.description || tableTypeName);

    // Build rowType XML
    const typeKind = params.row_type_kind || 'dictionaryType';
    const typeName = params.row_type_name
      ? params.row_type_name.toUpperCase()
      : '';
    const accessType = params.access_type || 'standard';
    const primaryKeyDefinition = params.primary_key_definition || 'standard';
    const primaryKeyKind = params.primary_key_kind || 'nonUnique';

    // Read existing metadata to get packageRef
    const { getTableTypeMetadata } = await import('./read');
    let packageRefXml = '';
    try {
      const metadataResponse = await getTableTypeMetadata(
        connection,
        tableTypeName,
        undefined,
        logger,
      );
      const metadataXml =
        typeof metadataResponse.data === 'string' ? metadataResponse.data : '';
      // Extract packageRef from metadata
      const packageRefMatch = metadataXml.match(/<adtcore:packageRef[^>]*>/);
      if (packageRefMatch) {
        packageRefXml = `\n  ${packageRefMatch[0]}`;
      }
    } catch (_error) {
      // If reading metadata fails, continue without packageRef
      // Server might accept update without it
    }

    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<ttyp:tableType xmlns:ttyp="http://www.sap.com/dictionary/tabletype"
                xmlns:adtcore="http://www.sap.com/adt/core"
                adtcore:description="${description}"
                adtcore:name="${tableTypeName}"
                adtcore:type="TTYP/DA"
                adtcore:version="active"
                adtcore:language="EN"
                adtcore:masterLanguage="EN"${masterSystemAttr}${responsibleAttr}>${packageRefXml}
  <ttyp:rowType>
    <ttyp:typeKind>${typeKind}</ttyp:typeKind>
    <ttyp:typeName>${typeName}</ttyp:typeName>
    <ttyp:builtInType>
      <ttyp:dataType/>
      <ttyp:length>0</ttyp:length>
      <ttyp:decimals>0</ttyp:decimals>
    </ttyp:builtInType>
    <ttyp:rangeType/>
  </ttyp:rowType>
  <ttyp:initialRowCount>0</ttyp:initialRowCount>
  <ttyp:accessType>${accessType}</ttyp:accessType>
  <ttyp:primaryKey ttyp:isVisible="true" ttyp:isEditable="true">
    <ttyp:definition>${primaryKeyDefinition}</ttyp:definition>
    <ttyp:kind>${primaryKeyKind}</ttyp:kind>
    <ttyp:components ttyp:isVisible="false"/>
    <ttyp:alias/>
  </ttyp:primaryKey>
  <ttyp:secondaryKeys ttyp:isVisible="true" ttyp:isEditable="true">
    <ttyp:allowed>notSpecified</ttyp:allowed>
  </ttyp:secondaryKeys>
  <ttyp:valueHelps>
    <ttyp:typeKindValues>
      <ttyp:valueHelp ttyp:key="dictionaryType" ttyp:value="Dictionary Type" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="predefinedAbapType" ttyp:value="Predefined Type" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="refToPredefinedAbapType" ttyp:value="Reference to Predefined Type" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="refToDictionaryType" ttyp:value="Reference to Dictionary Type" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="refToClassOrInterfaceType" ttyp:value="Reference to Class/Interface" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="rangeTypeOnPredefinedType" ttyp:value="Range Table on Predefined Type" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="rangeTypeOnDataelement" ttyp:value="Range Table on Data Element" ttyp:description=""/>
    </ttyp:typeKindValues>
    <ttyp:keyDefinitionValues>
      <ttyp:valueHelp ttyp:key="standard" ttyp:value="Standard Key" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="rowType" ttyp:value="Row Type" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="keyComponents" ttyp:value="Key Components" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="empty" ttyp:value="Empty Key" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="notSpecified" ttyp:value="Not Specified" ttyp:description=""/>
    </ttyp:keyDefinitionValues>
    <ttyp:keyKindValues>
      <ttyp:valueHelp ttyp:key="unique" ttyp:value="Unique" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="nonUnique" ttyp:value="Non-Unique" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="notSpecified" ttyp:value="Not Specified" ttyp:description=""/>
    </ttyp:keyKindValues>
    <ttyp:accessTypeValues>
      <ttyp:valueHelp ttyp:key="standard" ttyp:value="Standard Table" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="sorted" ttyp:value="Sorted Table" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="hashed" ttyp:value="Hashed Table" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="index" ttyp:value="Index Table" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="notSpecified" ttyp:value="Not Specified" ttyp:description=""/>
    </ttyp:accessTypeValues>
    <ttyp:secKeyAccessValues>
      <ttyp:valueHelp ttyp:key="uniqueHashed" ttyp:value="Unique Hashed" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="uniqueSorted" ttyp:value="Unique Sorted" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="nonUniqueSorted" ttyp:value="Non-Unique Sorted" ttyp:description=""/>
    </ttyp:secKeyAccessValues>
    <ttyp:secKeyDefinitionValues>
      <ttyp:valueHelp ttyp:key="rowType" ttyp:value="Row Type" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="keyComponents" ttyp:value="Key Components" ttyp:description=""/>
    </ttyp:secKeyDefinitionValues>
    <ttyp:secKeyAllowedValues>
      <ttyp:valueHelp ttyp:key="allowed" ttyp:value="Allowed" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="notAllowed" ttyp:value="Not Allowed" ttyp:description=""/>
      <ttyp:valueHelp ttyp:key="notSpecified" ttyp:value="Not Specified" ttyp:description=""/>
    </ttyp:secKeyAllowedValues>
  </ttyp:valueHelps>
</ttyp:tableType>`;

    const headers = {
      Accept: 'application/vnd.sap.adt.tabletype.v1+xml',
      'Content-Type': 'application/vnd.sap.adt.tabletype.v1+xml',
    };

    try {
      return await connection.makeAdtRequest({
        url,
        method: 'PUT',
        timeout: getTimeout('default'),
        data: xmlBody,
        headers,
      });
    } catch (error: any) {
      // Extract full response data
      const status = error.response?.status || 'unknown';
      const statusText = error.response?.statusText || '';
      const responseHeaders = JSON.stringify(
        error.response?.headers || {},
        null,
        2,
      );
      const responseData = error.response?.data
        ? typeof error.response.data === 'string'
          ? error.response.data
          : JSON.stringify(error.response.data, null, 2)
        : error.message || 'No response data';

      // Build full error message with all details
      const fullError = `Failed to update table type ${params.tabletype_name}
HTTP Status: ${status} ${statusText}
Response Headers: ${responseHeaders}
Response Data: ${responseData}
Request URL: ${url}
Request Headers: ${JSON.stringify(headers, null, 2)}
Request Body:
${xmlBody}`;

      // Output to stderr (always visible)
      logger?.error?.(fullError);

      throw new Error(fullError);
    }
  }
}
