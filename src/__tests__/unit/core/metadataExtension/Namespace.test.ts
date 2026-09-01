/**
 * Regression tests: namespaced (e.g. /NSP/) metadata extension (DDLX) names must
 * be URL-encoded in the request path, exactly like class/interface/view do.
 *
 * Bug: DDLX URLs were built with `${name.toLowerCase()}` (raw), so a name like
 * `/NSP/C_TEST` produced `.../ddlx/sources//nsp/c_test`, with raw slashes that
 * break the ADT path. The encoded form must be `%2fnsp%2fc_test`.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { activateMetadataExtension } from '../../../../core/metadataExtension/activate';
import { deleteMetadataExtension } from '../../../../core/metadataExtension/delete';
import { lockMetadataExtension } from '../../../../core/metadataExtension/lock';
import {
  getMetadataExtensionTransport,
  readMetadataExtension,
  readMetadataExtensionSource,
} from '../../../../core/metadataExtension/read';
import { unlockMetadataExtension } from '../../../../core/metadataExtension/unlock';
import { updateMetadataExtension } from '../../../../core/metadataExtension/update';

const LOCK_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA><LOCK_HANDLE>LH123</LOCK_HANDLE><CORRNR/></DATA></asx:values></asx:abap>`;

function createConnectionMock(data = '') {
  return {
    makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data }),
  } as unknown as IAbapConnection;
}

function firstUrl(connection: IAbapConnection): string {
  return (connection.makeAdtRequest as jest.Mock).mock.calls[0][0].url;
}

const NS_NAME = '/NSP/C_TEST';
const ENCODED = 'ddic/ddlx/sources/%2fnsp%2fc_test';
const RAW_SLASHES = 'ddic/ddlx/sources//nsp';

describe('metadata extension namespace URL encoding', () => {
  it('lockMetadataExtension() encodes the namespaced name in the path', async () => {
    const connection = createConnectionMock(LOCK_RESPONSE);
    await lockMetadataExtension(connection, NS_NAME);
    const url = firstUrl(connection);
    expect(url).toContain(ENCODED);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('unlockMetadataExtension() encodes the namespaced name in the path', async () => {
    const connection = createConnectionMock();
    await unlockMetadataExtension(connection, NS_NAME, 'LH123');
    const url = firstUrl(connection);
    expect(url).toContain(ENCODED);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('updateMetadataExtension() encodes the namespaced name in the path', async () => {
    const connection = createConnectionMock();
    await updateMetadataExtension(
      connection,
      NS_NAME,
      '@Metadata.layer: #CUSTOMER\nannotate entity X with {}',
      'LH123',
    );
    const url = firstUrl(connection);
    expect(url).toContain(`${ENCODED}/source/main`);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('deleteMetadataExtension() encodes the namespaced name in the path', async () => {
    const connection = createConnectionMock();
    await deleteMetadataExtension(connection, NS_NAME, undefined);
    const url = firstUrl(connection);
    expect(url).toContain(ENCODED);
    expect(url).not.toContain(RAW_SLASHES);
  });

  // The four call sites below were changed by the same fix and had no case of
  // their own. Verified by removing the encoding from each in turn and watching
  // exactly one test go red — before that, `read.ts` could be reverted whole and
  // the suite stayed green.

  it('readMetadataExtension() encodes the namespaced name in the path', async () => {
    const connection = createConnectionMock();
    await readMetadataExtension(connection, NS_NAME);
    const url = firstUrl(connection);
    expect(url).toContain(ENCODED);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('readMetadataExtensionSource() encodes it too, on the source sub-resource', async () => {
    const connection = createConnectionMock();
    await readMetadataExtensionSource(connection, NS_NAME);
    const url = firstUrl(connection);
    expect(url).toContain(ENCODED);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('getMetadataExtensionTransport() encodes it on the transport sub-resource', async () => {
    const connection = createConnectionMock();
    await getMetadataExtensionTransport(connection, NS_NAME);
    const url = firstUrl(connection);
    expect(url).toContain(`${ENCODED}/transport`);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('activateMetadataExtension() encodes it in the object reference, not the URL', async () => {
    // Activation posts to a fixed URL and carries the object as `adtcore:uri`
    // in the body, so this asserts the payload. Same encoding either way, but
    // it is a different claim from the five above, and worth naming as one.
    const connection = createConnectionMock();
    await activateMetadataExtension(connection, NS_NAME);
    const body = String(
      (connection.makeAdtRequest as jest.Mock).mock.calls[0][0].data,
    );
    expect(body).toContain(`adtcore:uri="/sap/bc/adt/${ENCODED}"`);
    expect(body).not.toContain(RAW_SLASHES);
  });

  it('does not alter plain (non-namespaced) names', async () => {
    const connection = createConnectionMock(LOCK_RESPONSE);
    await lockMetadataExtension(connection, 'ZC_MY_DDLX');
    const url = firstUrl(connection);
    expect(url).toContain('ddic/ddlx/sources/zc_my_ddlx');
  });
});
