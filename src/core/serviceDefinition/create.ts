/**
 * ServiceDefinition create operations - Low-level functions
 * NOTE: Builder should call connection.setSessionType("stateful") before creating
 */

import { AbapConnection, getTimeout } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { CreateServiceDefinitionParams } from './types';

/**
 * Low-level: Create service definition (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: AbapConnection,
  args: CreateServiceDefinitionParams
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/srvd/sources${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  // Get system information for cloud systems
  const systemInfo = await getSystemInformation(connection);
  const username = systemInfo?.userName || '';
  const masterSystem = systemInfo?.systemID || '';
  const masterLanguage = systemInfo?.language || 'EN';

  const description = args.description || args.service_definition_name;
  const serviceDefinitionName = args.service_definition_name.toUpperCase();

  const masterSystemAttr = masterSystem ? ` adtcore:masterSystem="${masterSystem}"` : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><srvd:srvdSource xmlns:srvd="http://www.sap.com/adt/ddic/srvdsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${masterLanguage}" adtcore:name="${serviceDefinitionName}" adtcore:type="SRVD/SRV" adtcore:masterLanguage="${masterLanguage}"${masterSystemAttr} adtcore:responsible="${username}" srvd:srvdSourceType="S">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</srvd:srvdSource>`;

  const headers = {
    'Accept': 'application/vnd.sap.adt.ddic.srvd.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.ddic.srvd.v1+xml'
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers
  });
}

