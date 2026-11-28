/**
 * Type group activation: one `POST /sap/bc/adt/activation` naming the type
 * group, as measured (`chkl:messages`, `activationExecuted="true"`).
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { TYPE_GROUP } from '../../endpoints/objects';
import { requestHeaders } from '../../utils/requestHeaders';
import { escapeXmlAttr } from '../../utils/xml';

export async function activateTypeGroup(
  connection: IAbapConnection,
  headers: IAdtHeaders,
  typeGroupName: string,
  preauditRequested: boolean,
): Promise<IAdtWireResponse> {
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="${escapeXmlAttr(TYPE_GROUP.uri(typeGroupName))}" adtcore:name="${escapeXmlAttr(typeGroupName)}"/>
</adtcore:objectReferences>`;
  return connection.makeAdtRequest({
    url: `/sap/bc/adt/activation?method=activate&preauditRequested=${preauditRequested}`,
    method: 'POST',
    timeout: 0,
    data: body,
    headers: requestHeaders(headers),
  });
}
