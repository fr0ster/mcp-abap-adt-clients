import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtMessageClass } from '../../core/messageClass/AdtMessageClass';
import { noopLogger } from '../../utils/noopLogger';

const CLASS_XML = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N" adtcore:description="D"><adtcore:packageRef adtcore:name="ZP"/></mc:messageClass>`;
const LOCK = `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

function conn(handler: (o: any) => Promise<IAdtResponse>): IAbapConnection {
  return {
    makeAdtRequest: handler,
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

describe('AdtMessageClass', () => {
  it('create POSTs the shell to /messageclass', async () => {
    let seen: any;
    const mc = new AdtMessageClass(
      conn(async (o) => {
        seen = o;
        return { data: '', status: 201, headers: {} } as IAdtResponse;
      }),
      noopLogger,
    );
    await mc.create({ name: 'ZT', description: 'D', packageName: 'ZP' });
    expect(seen.url).toContain('/sap/bc/adt/messageclass');
    expect(seen.method).toBe('POST');
    expect(String(seen.data)).toContain('adtcore:type="MSAG/N"');
  });

  it('read GETs /messageclass/{name} and parses', async () => {
    const mc = new AdtMessageClass(
      conn(
        async () =>
          ({ data: CLASS_XML, status: 200, headers: {} }) as IAdtResponse,
      ),
      noopLogger,
    );
    const st = await mc.read({ name: 'ZT' });
    expect(st?.messageClass?.name).toBe('ZT');
  });

  it('activate/check/getVersions throw UNSUPPORTED', async () => {
    const mc = new AdtMessageClass(
      conn(async () => ({}) as IAdtResponse),
      noopLogger,
    );
    for (const fn of [
      () => mc.activate({ name: 'ZT' }),
      () => mc.check({ name: 'ZT' }),
      () => mc.getVersions({ name: 'ZT' }),
    ]) {
      await expect(fn()).rejects.toMatchObject({
        code: 'ADT_UNSUPPORTED_OPERATION',
      });
    }
  });
});
