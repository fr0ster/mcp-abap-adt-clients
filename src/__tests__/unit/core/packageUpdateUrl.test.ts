import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { updatePackage } from '../../../core/package/update';

function capturingConnection(): {
  connection: IAbapConnection;
  urls: string[];
} {
  const urls: string[] = [];
  const makeAdtRequest = jest.fn(async (options: { url: string }) => {
    urls.push(options.url);
    return { status: 200, data: '' };
  });
  return {
    connection: { makeAdtRequest } as unknown as IAbapConnection,
    urls,
  };
}

/**
 * The package PUT builds its query like every other write.
 *
 * It used to interpolate `encodeURIComponent(lockHandle)` unconditionally, so
 * a caller with no handle sent `?lockHandle=undefined`. Measured on E19
 * 2026-09-26: SAP answered 423 `SADT_RESOURCE/026`, "invalid lock handle:
 * undefined" — a refusal about a handle nobody passed, where the endpoint's
 * own answer to a missing handle is a different message.
 */
describe('updatePackage URL', () => {
  const params = {
    package_name: 'ZAC_PKG',
    transport_request: 'E19K900001',
  } as never;

  it('carries the handle and the transport when both are given', async () => {
    const { connection, urls } = capturingConnection();
    await updatePackage(connection, params, '<pak:package/>', 'ABC123');
    expect(urls).toEqual([
      '/sap/bc/adt/packages/zac_pkg?lockHandle=ABC123&corrNr=E19K900001',
    ]);
  });

  it('sends no lockHandle parameter when there is no handle', async () => {
    const { connection, urls } = capturingConnection();
    await updatePackage(
      connection,
      params,
      '<pak:package/>',
      undefined as unknown as string,
    );
    expect(urls).toEqual(['/sap/bc/adt/packages/zac_pkg?corrNr=E19K900001']);
  });
});
