/**
 * Resolve transport request for an object via /sap/bc/adt/cts/transportchecks
 *
 * Before create/update, call this to determine which TR the object
 * is already assigned to, or which TRs are available.
 * Prevents ABAP dumps when a wrong transport request number is provided.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { getTimeout } from '../../utils/timeouts';

export interface IResolveTransportParams {
  /** PGMID, e.g. 'R3TR' */
  pgmid?: string;
  /** Object type, e.g. 'CLAS', 'PROG', 'DDLS', 'TABL', 'DOMA', 'DTEL', 'FUGR', 'DEVC' */
  objectType?: string;
  /** Object name, e.g. 'ZCL_MY_CLASS' */
  objectName?: string;
  /** Package name (DEVCLASS) */
  devclass: string;
  /** Object URI, e.g. '/sap/bc/adt/oo/classes/zcl_my_class' */
  uri?: string;
  /** Operation: 'I' = insert (create), 'U' = update. Default: 'I' */
  operation?: 'I' | 'U';
}

export interface IResolveTransportResult {
  /** Whether the check succeeded */
  success: boolean;
  /** Transport request the object is locked in (from LOCKS) */
  lockedInTransport?: string;
  /** Available transport requests */
  availableTransports: string[];
  /** Whether the object is in a local ($TMP) package — no transport needed */
  isLocal: boolean;
  /** Raw RECORDING field value */
  recording?: string;
}

/**
 * Resolve transport request for an object.
 * Calls /sap/bc/adt/cts/transportchecks to determine:
 * - Which TR the object is already assigned to (LOCKS)
 * - Which TRs are available (REQUESTS)
 * - Whether the object is local ($TMP)
 */
export async function resolveTransport(
  connection: IAbapConnection,
  params: IResolveTransportParams,
): Promise<IResolveTransportResult> {
  const url = `/sap/bc/adt/cts/transportchecks`;

  const pgmid = params.pgmid ?? '';
  const objectType = params.objectType ?? '';
  const objectName = params.objectName ?? '';
  const operation = params.operation ?? 'I';
  const uri = params.uri ?? '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0">
  <asx:values>
    <DATA>
      <PGMID>${pgmid}</PGMID>
      <OBJECT>${objectType}</OBJECT>
      <OBJECTNAME>${objectName}</OBJECTNAME>
      <DEVCLASS>${params.devclass}</DEVCLASS>
      <SUPER_PACKAGE/>
      <RECORD_CHANGES/>
      <OPERATION>${operation}</OPERATION>
      <URI>${uri}</URI>
    </DATA>
  </asx:values>
</asx:abap>`;

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers: {
      Accept:
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.transport.service.checkData',
      'Content-Type':
        'application/vnd.sap.as+xml; charset=UTF-8; dataname=com.sap.adt.transport.service.checkData',
    },
  });

  const parser = new XMLParser({ ignoreAttributes: false });
  const result = parser.parse(response.data);
  const data = result['asx:abap']?.['asx:values']?.DATA;

  // Extract locked transport (object already assigned to a TR)
  const locks = data?.LOCKS?.CTS_OBJECT_LOCK;
  const lockList = locks ? (Array.isArray(locks) ? locks : [locks]) : [];
  const lockedInTransport = lockList
    .map(
      (lock: Record<string, unknown>) =>
        (lock.LOCK_HOLDER as Record<string, unknown>)?.REQ_HEADER as Record<
          string,
          unknown
        >,
    )
    .map((header) => header?.TRKORR as string | undefined)
    .find((trkorr) => trkorr);

  // Extract available transports
  const requests = data?.REQUESTS?.CTS_REQUEST || [];
  const transportList = Array.isArray(requests) ? requests : [requests];
  const availableTransports = transportList
    .map(
      (req: Record<string, unknown>) =>
        (req.REQ_HEADER as Record<string, unknown>)?.TRKORR as string,
    )
    .filter((trkorr: string | undefined) => trkorr);

  // Check if local package (no transport needed)
  const recording = data?.RECORDING;
  const isLocal = recording === '' || params.devclass === '$TMP';

  return {
    success: data?.RESULT === 'S',
    lockedInTransport,
    availableTransports,
    isLocal,
    recording,
  };
}
