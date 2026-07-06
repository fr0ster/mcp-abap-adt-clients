import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { AdtPackage } from '../../core/package/AdtPackage';

describe('AdtPackage version history (non-source)', () => {
  it('throws UNSUPPORTED_OPERATION without any HTTP call', async () => {
    expect.assertions(2);
    let called = false;
    const c = {
      makeAdtRequest: async () => {
        called = true;
        return { data: '', status: 200, headers: {} } as any;
      },
      setSessionType: () => {},
    } as unknown as IAbapConnection;
    const pkg = new AdtPackage(c);
    await expect(
      pkg.getVersions({ packageName: 'ZPKG' }),
    ).rejects.toMatchObject({ code: 'ADT_UNSUPPORTED_OPERATION' });
    expect(called).toBe(false);
  });
});
