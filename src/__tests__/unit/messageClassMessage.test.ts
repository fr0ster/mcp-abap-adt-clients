import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtMessageClassMessage } from '../../core/messageClass/AdtMessageClassMessage';
import { noopLogger } from '../../utils/noopLogger';

const CLASS_XML = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N"><adtcore:packageRef adtcore:name="ZP"/><mc:messages mc:msgno="001" mc:msgtext="T1"/></mc:messageClass>`;
const LOCK = (h: string) =>
  `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>${h}</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

function recorder() {
  const calls: any[] = [];
  const conn = {
    setSessionType: () => {},
    makeAdtRequest: async (o: any) => {
      calls.push(o);
      if (String(o.url).includes('_action=LOCK_MSG'))
        return { data: LOCK('MH'), status: 200, headers: {} } as IAdtResponse;
      if (String(o.url).includes('_action=LOCK'))
        return { data: LOCK('CH'), status: 200, headers: {} } as IAdtResponse;
      if (o.method === 'GET')
        return { data: CLASS_XML, status: 200, headers: {} } as IAdtResponse;
      return { data: '', status: 200, headers: {} } as IAdtResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

describe('AdtMessageClassMessage', () => {
  it('read extracts the message from the class', async () => {
    const { conn } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    const st = await m.read({ className: 'ZT', msgno: '001' });
    expect(st?.message?.msgtext).toBe('T1');
  });

  it('update does LOCK_MSG + class LOCK + PUT(full class, lockhandle) + UNLOCK + UNLOCK_ALL', async () => {
    const { conn, calls } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    await m.update({ className: 'ZT', msgno: '001', msgtext: 'NEW' });
    const urls = calls.map((c) => `${c.method} ${c.url}`);
    expect(urls.some((u) => u.includes('/messages/001?_action=LOCK_MSG'))).toBe(
      true,
    );
    expect(
      urls.some(
        (u) =>
          u.includes('?_action=LOCK') &&
          u.includes('msgNo=001') &&
          u.includes('onSave=X'),
      ),
    ).toBe(true);
    const put = calls.find((c) => c.method === 'PUT');
    expect(String(put.data)).toContain('mc:msgtext="NEW"');
    expect(String(put.data)).toContain('mc:lockhandle="MH"');
    expect(urls.some((u) => u.includes('?_action=UNLOCK'))).toBe(true);
    expect(
      urls.some((u) => u.includes('/messages/001?_action=UNLOCK_ALL')),
    ).toBe(true);
  });

  it('delete PUTs the class without the message', async () => {
    const { conn, calls } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    await m.delete({ className: 'ZT', msgno: '001' });
    const put = calls.find((c) => c.method === 'PUT');
    expect(String(put.data)).not.toContain('mc:msgno="001"');
  });

  it('activate/lock/getVersions throw UNSUPPORTED', async () => {
    const { conn } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    for (const fn of [
      () => m.activate({ className: 'ZT', msgno: '001' }),
      () => m.lock({ className: 'ZT', msgno: '001' }),
      () => m.getVersions({ className: 'ZT', msgno: '001' }),
    ]) {
      await expect(fn()).rejects.toMatchObject({
        code: 'ADT_UNSUPPORTED_OPERATION',
      });
    }
  });
});
