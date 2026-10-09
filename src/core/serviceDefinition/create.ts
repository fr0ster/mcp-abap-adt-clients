/**
 * ServiceDefinition create operations - Low-level functions
 * NOTE: Caller should call connection.setSessionType("stateful") before creating
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { CT_SERVICE_DEFINITION } from '../../constants/contentTypes';
import { SERVICE_DEFINITION } from '../../endpoints/objects';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import { escapeXmlAttr } from '../../utils/xml';
import type { ICreateServiceDefinitionParams } from './types';

/**
 * Low-level: Create service definition (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateServiceDefinitionParams,
): Promise<IAdtWireResponse> {
  const url = `${SERVICE_DEFINITION.collection}${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const username = escapeXmlAttr(args.responsible || '');
  const masterSystem = escapeXmlAttr(args.masterSystem || '');

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(
    args.description || args.service_definition_name,
  );
  const serviceDefinitionName = args.service_definition_name.toUpperCase();

  // Absent means absent: an empty attribute is not "no responsible person".
  const responsibleAttr = username ? ` adtcore:responsible="${username}"` : '';
  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><srvd:srvdSource xmlns:srvd="http://www.sap.com/adt/ddic/srvdsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${args.masterLanguage || 'EN'}" adtcore:name="${serviceDefinitionName}" adtcore:type="SRVD/SRV" adtcore:masterLanguage="${args.masterLanguage || 'EN'}"${masterSystemAttr}${responsibleAttr} srvd:srvdSourceType="S">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</srvd:srvdSource>`;

  const headers = {
    Accept: CT_SERVICE_DEFINITION,
    'Content-Type': CT_SERVICE_DEFINITION,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
