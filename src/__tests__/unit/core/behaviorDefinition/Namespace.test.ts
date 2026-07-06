/**
 * Regression tests: namespaced (e.g. /NSP/) behavior definition names must be
 * URL-encoded in the request path, exactly like class/interface/view do.
 *
 * Bug: BDEF URLs were built with `${name.toLowerCase()}` (raw), so a name like
 * `/NSP/R_TEST` produced `.../behaviordefinitions//nsp/r_test`, with raw slashes
 * that break the ADT path. The encoded form must be `%2fnsp%2fr_test`.
 */

import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { lock, lockForUpdate } from '../../../../core/behaviorDefinition/lock';
import { unlock } from '../../../../core/behaviorDefinition/unlock';
import { update } from '../../../../core/behaviorDefinition/update';

const LOCK_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?><asx:abap xmlns:asx="http://www.sap.com/abapxml" version="1.0"><asx:values><DATA><LOCK_HANDLE>LH123</LOCK_HANDLE><CORRNR/></DATA></asx:values></asx:abap>`;

function createConnectionMock(data = '') {
  return {
    makeAdtRequest: jest.fn().mockResolvedValue({ status: 200, data }),
  } as unknown as IAbapConnection;
}

function firstUrl(connection: IAbapConnection): string {
  return (connection.makeAdtRequest as jest.Mock).mock.calls[0][0].url;
}

const NS_NAME = '/NSP/R_TEST';
const ENCODED = 'behaviordefinitions/%2fnsp%2fr_test';
const RAW_SLASHES = 'behaviordefinitions//nsp';

describe('behavior definition namespace URL encoding', () => {
  it('lock() encodes the namespaced name in the path', async () => {
    const connection = createConnectionMock(LOCK_RESPONSE);
    await lock(connection, NS_NAME);
    const url = firstUrl(connection);
    expect(url).toContain(ENCODED);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('lockForUpdate() encodes the namespaced name in the path', async () => {
    const connection = createConnectionMock(LOCK_RESPONSE);
    await lockForUpdate(connection, NS_NAME, 'session');
    const url = firstUrl(connection);
    expect(url).toContain(ENCODED);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('update() encodes the namespaced name in the path', async () => {
    const connection = createConnectionMock();
    await update(connection, {
      name: NS_NAME,
      sourceCode: 'managed; define behavior for ZX {}',
      lockHandle: 'LH123',
    });
    const url = firstUrl(connection);
    expect(url).toContain(ENCODED);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('unlock() encodes the namespaced name in the path', async () => {
    const connection = createConnectionMock();
    await unlock(connection, NS_NAME, 'LH123');
    const url = firstUrl(connection);
    expect(url).toContain(ENCODED);
    expect(url).not.toContain(RAW_SLASHES);
  });

  it('does not alter plain (non-namespaced) names', async () => {
    const connection = createConnectionMock(LOCK_RESPONSE);
    await lock(connection, 'Z_MY_BDEF');
    const url = firstUrl(connection);
    expect(url).toContain('behaviordefinitions/z_my_bdef');
  });
});
