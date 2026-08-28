/**
 * Standalone `PROG/I` include creation — low-level.
 *
 * Transcribed from a captured Eclipse exchange, not adapted from the program
 * path. The document is a different one: root `include:abapInclude`, its own
 * namespace, `adtcore:type="PROG/I"`, and — as much to the point — **no**
 * `program:programType` and no `program:application`. An include has neither.
 *
 * Creatable on modern on-prem only: that is the only place discovery gives the
 * collection an `app:accept`, and a collection without one is not a POST
 * target. Elsewhere this request fails for a reason no header can fix.
 */

import type {
  IAbapConnection,
  IAdtContentTypes,
  IAdtResponse,
  ICreateIncludeParams,
} from '@mcp-abap-adt/interfaces';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/** Measured on the includes collection; the programs one advertises a different type. */
export const CT_INCLUDE = 'application/vnd.sap.adt.programs.includes.v2+xml';

export async function create(
  connection: IAbapConnection,
  args: ICreateIncludeParams,
  contentTypes?: IAdtContentTypes,
): Promise<IAdtResponse> {
  const description = limitDescription(args.description || args.includeName);
  const lang = args.masterLanguage || 'EN';
  const masterSystemAttr = args.masterSystem
    ? ` adtcore:masterSystem="${args.masterSystem}"`
    : '';
  const responsibleAttr = args.responsible
    ? ` adtcore:responsible="${args.responsible}"`
    : '';
  const url = `/sap/bc/adt/programs/includes${args.transportRequest ? `?corrNr=${args.transportRequest}` : ''}`;

  const metadataXml = `<?xml version="1.0" encoding="UTF-8"?><include:abapInclude xmlns:include="http://www.sap.com/adt/programs/includes" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="${lang}" adtcore:name="${args.includeName}" adtcore:type="PROG/I" adtcore:masterLanguage="${lang}"${masterSystemAttr}${responsibleAttr}>
  <adtcore:packageRef adtcore:name="${args.packageName}"/>
</include:abapInclude>`;

  const ct = contentTypes?.includeCreate();
  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: metadataXml,
    headers: {
      // Eclipse sends no Accept here, only the content type; both were
      // accepted in the captured exchange.
      Accept: ct?.accept || CT_INCLUDE,
      'Content-Type': ct?.contentType || CT_INCLUDE,
    },
  });
}
