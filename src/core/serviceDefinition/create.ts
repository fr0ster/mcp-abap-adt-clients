/**
 * ServiceDefinition create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */

import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateServiceDefinitionParams } from './types';

/**
 * Low-level: Create service definition (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateServiceDefinitionParams,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/ddic/srvd/sources${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const username = args.responsible || '';
  const masterSystem = args.masterSystem || '';

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(
    args.description || args.service_definition_name,
  );
  const serviceDefinitionName = args.service_definition_name.toUpperCase();

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><srvd:srvdSource xmlns:srvd="http://www.sap.com/adt/ddic/srvdsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${serviceDefinitionName}" adtcore:type="SRVD/SRV" adtcore:masterLanguage="EN"${masterSystemAttr} adtcore:responsible="${username}" srvd:srvdSourceType="S">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</srvd:srvdSource>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.ddic.srvd.v1+xml',
    'Content-Type': 'application/vnd.sap.adt.ddic.srvd.v1+xml',
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
