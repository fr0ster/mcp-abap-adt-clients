import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getSystemInformation } from '../../utils/systemInfo';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateAccessControlParams } from './types';

/**
 * Low-level: Create access control (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateAccessControlParams,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/acm/dcl/sources${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  // Get system information for cloud systems
  const systemInfo = await getSystemInformation(connection);
  const username = systemInfo?.userName || '';
  const masterSystem = systemInfo?.systemID || '';
  const masterLanguage = systemInfo?.language || 'EN';

  // Description is limited to 60 characters in SAP ADT
  const description = limitDescription(
    args.description || args.access_control_name,
  );
  const accessControlName = args.access_control_name.toUpperCase();

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><dcl:dclSource xmlns:dcl="http://www.sap.com/adt/acm/dclsources" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${masterLanguage}" adtcore:name="${accessControlName}" adtcore:type="DCLS/DL" adtcore:masterLanguage="${masterLanguage}"${masterSystemAttr} adtcore:responsible="${username}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</dcl:dclSource>`;

  const headers = {
    Accept: 'application/vnd.sap.adt.dclSource+xml',
    'Content-Type': 'application/vnd.sap.adt.dclSource+xml',
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
