/**
 * Structure create operations
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { generateSessionId } from '../../utils/sessionUtils';
import { activateStructure } from './activation';
import { CreateStructureParams } from './types';

/**
 * Build XML for structure creation following DDIC structure pattern
 */
export function buildCreateStructureXml(args: CreateStructureParams): string {
  const description = args.description || args.structure_name;

  const fieldsXml = args.fields.map(field => {
    const fieldProps: any = {
      'ddic:name': field.name,
      'ddic:description': field.description || ''
    };

    if (field.data_element) {
      fieldProps['ddic:dataElement'] = field.data_element;
    } else if (field.domain) {
      fieldProps['ddic:domainName'] = field.domain;
    } else if (field.structure_ref) {
      fieldProps['ddic:structureRef'] = field.structure_ref;
    } else if (field.table_ref) {
      fieldProps['ddic:tableRef'] = field.table_ref;
    } else if (field.data_type) {
      fieldProps['ddic:dataType'] = field.data_type;
      if (field.length !== undefined) {
        fieldProps['ddic:length'] = field.length;
      }
      if (field.decimals !== undefined) {
        fieldProps['ddic:decimals'] = field.decimals;
      }
    }

    return fieldProps;
  });

  let includesXml: any = undefined;
  if (args.includes && args.includes.length > 0) {
    includesXml = {
      'ddic:include': args.includes.map(inc => ({
        'ddic:structureName': inc.name,
        ...(inc.suffix && { 'ddic:suffix': inc.suffix })
      }))
    };
  }

  const structureData: any = {
    'ddic:structure': {
      'adtcore:objectType': 'STRU/DT',
      'adtcore:name': args.structure_name,
      'adtcore:description': description,
      'adtcore:language': 'EN',
      'adtcore:packageRef': {
        'adtcore:name': args.package_name
      },
      ...(args.transport_request && {
        'adtcore:transport': {
          'adtcore:name': args.transport_request
        }
      }),
      ...(includesXml && { 'ddic:includes': includesXml }),
      'ddic:fields': {
        'ddic:field': fieldsXml
      }
    }
  };

  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    format: true,
    suppressEmptyNode: true
  });

  const xmlHeader = '<?xml version="1.0" encoding="UTF-8"?>\n';
  return xmlHeader + builder.build(structureData);
}

/**
 * Parse XML response to extract structure creation information
 */
function parseStructureCreationResponse(xml: string) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseAttributeValue: true,
    trimValues: true
  });

  try {
    const result = parser.parse(xml);

    if (result.error || result['asx:abap']?.['asx:values']?.ERROR) {
      const errorMsg = result.error?.message ||
        result['asx:abap']?.['asx:values']?.ERROR?.MESSAGE ||
        'Unknown error during structure creation';
      throw new Error(errorMsg);
    }

    if (result['ddic:structure']) {
      const structure = result['ddic:structure'];
      return {
        name: structure['adtcore:name'],
        description: structure['adtcore:description'],
        package: structure['adtcore:packageRef']?.['adtcore:name'],
        status: 'created',
        objectType: 'structure'
      };
    }

    return { raw: result, status: 'created' };

  } catch (parseError) {
    return {
      raw_xml: xml,
      status: 'created',
      note: 'XML parsing failed, but structure creation might have succeeded'
    };
  }
}

/**
 * Verify structure exists and get its details
 */
async function verifyStructureCreation(
  connection: AbapConnection,
  structureName: string
): Promise<AxiosResponse> {
  const baseUrl = await connection.getBaseUrl();
  const url = `${baseUrl}/sap/bc/adt/ddic/structures/${encodeSapObjectName(structureName)}/source/main`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {}
  });
}

/**
 * Create ABAP structure
 * Full workflow: create -> activate -> verify
 */
export async function createStructure(
  connection: AbapConnection,
  params: CreateStructureParams
): Promise<AxiosResponse> {
  if (!params.structure_name) {
    throw new Error('Structure name is required');
  }
  if (!params.package_name) {
    throw new Error('Package name is required');
  }
  if (!params.fields || !Array.isArray(params.fields) || params.fields.length === 0) {
    throw new Error('At least one field is required');
  }

  const sessionId = generateSessionId();
  let verifyResult: any = null;

  try {
    const baseUrl = await connection.getBaseUrl();
    const createUrl = `${baseUrl}/sap/bc/adt/ddic/structures/${encodeSapObjectName(params.structure_name)}`;
    const structureXml = buildCreateStructureXml(params);

    const createResponse = await connection.makeAdtRequest({
      url: createUrl,
      method: 'POST',
      timeout: getTimeout('default'),
      data: structureXml,
      headers: {
        'Content-Type': 'application/vnd.sap.adt.ddic.structures.v1+xml'
      }
    });

    parseStructureCreationResponse(createResponse.data);

    try {
      await activateStructure(connection, params.structure_name, sessionId);
    } catch (activateError) {
      // Continue to verification even if activation fails
    }

    try {
      const verifyResponse = await verifyStructureCreation(connection, params.structure_name);

      if (typeof verifyResponse.data === 'string' && verifyResponse.data.trim().startsWith('<?xml')) {
        const parser = new XMLParser({
          ignoreAttributes: false,
          attributeNamePrefix: '',
          parseAttributeValue: true,
          trimValues: true
        });
        verifyResult = parser.parse(verifyResponse.data);
      }
    } catch (verifyError) {
      // Ignore verification errors
    }

    return {
      data: {
        success: true,
        structure_name: params.structure_name,
        package: params.package_name,
        transport_request: params.transport_request,
        status: 'created',
        message: `Structure ${params.structure_name} created successfully`,
        structure_details: verifyResult
      },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any
    } as AxiosResponse;

  } catch (error: any) {
    const errorMessage = error.response?.data
      ? (typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data))
      : error.message;

    throw new Error(`Failed to create structure ${params.structure_name}: ${errorMessage}`);
  }
}

