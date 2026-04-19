import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

export async function unlockFeatureToggle(
  connection: IAbapConnection,
  name: string,
  lockHandle: string,
): Promise<void> {
  const encoded = encodeSapObjectName(name.toLowerCase());
  await connection.makeAdtRequest({
    method: 'POST',
    url: `/sap/bc/adt/sfw/featuretoggles/${encoded}`,
    timeout: getTimeout('default'),
    params: { _action: 'UNLOCK', lockHandle },
    headers: { 'X-sap-adt-sessiontype': 'stateful' },
  });
}
