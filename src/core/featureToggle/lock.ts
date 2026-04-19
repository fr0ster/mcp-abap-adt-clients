import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function lockFeatureToggle(
  connection: IAbapConnection,
  name: string,
  logger?: ILogger,
): Promise<string> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  const resp = await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    params: { _action: 'LOCK', accessMode: 'MODIFY' },
    headers: {
      'X-sap-adt-sessiontype': 'stateful',
      Accept:
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result2,' +
        'application/vnd.sap.as+xml;charset=UTF-8;dataname=com.sap.adt.lock.Result',
    },
  });
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });
  const parsed = parser.parse(resp.data);
  const handle = parsed?.['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;
  if (!handle) {
    logger?.error?.(`FeatureToggle lock: no LOCK_HANDLE in response`);
    throw new Error(`FeatureToggle ${name}: lock response has no LOCK_HANDLE`);
  }
  return String(handle);
}
