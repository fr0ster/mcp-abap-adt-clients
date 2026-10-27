/**
 * `getUtils().readObjectMetadata('FUGR/F', …)` asks for v3 first. Measured
 * on S/4HANA 2025 (2026-10-28, read only): the function group's GET answers
 * `406` with `functions.groups.v2+xml, functions.groups.v1+xml` and `200`
 * with `functions.groups.v3+xml`. v2 and v1 stay for older releases.
 */
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtUtils } from '../../../core/shared/AdtUtils';
import { noopLogger } from '../../../utils/noopLogger';

it('a function group metadata read sends v3, then v2 and v1', async () => {
  const sent: { url: string; method: string; headers?: unknown }[] = [];
  const connection = {
    setSessionType: jest.fn(),
    makeAdtRequest: jest.fn(
      async (request: { url: string; method: string; headers?: unknown }) => {
        sent.push(request);
        return { status: 200, statusText: 'OK', data: '<x/>', headers: {} };
      },
    ),
  } as unknown as IAbapConnection;

  await new AdtUtils(connection, noopLogger).readObjectMetadata(
    'FUGR/F',
    'ZFG_GUARD',
  );

  expect(sent).toHaveLength(1);
  expect(sent[0]?.method).toBe('GET');
  expect(sent[0]?.url).toBe('/sap/bc/adt/functions/groups/zfg_guard');
  expect(sent[0]?.headers).toEqual({
    Accept:
      'application/vnd.sap.adt.functions.groups.v3+xml, application/vnd.sap.adt.functions.groups.v2+xml, application/vnd.sap.adt.functions.groups.v1+xml',
  });
});
