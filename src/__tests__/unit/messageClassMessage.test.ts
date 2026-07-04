import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtMessageClassMessage } from '../../core/messageClass/AdtMessageClassMessage';
import { noopLogger } from '../../utils/noopLogger';

// Two-message class: 001 + 002. Both are needed for the delete test so we can
// assert 001 moves to <mc:deletedmessages> while 002 stays in <mc:messages>.
const CLASS_XML = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N"><adtcore:packageRef adtcore:name="ZP"/><mc:messages mc:msgno="001" mc:msgtext="T1"/><mc:messages mc:msgno="002" mc:msgtext="T2"/></mc:messageClass>`;

// Message 001 already carries selfExplanatory + description — used for round-trip tests
const CLASS_XML_WITH_FLAGS = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N"><adtcore:packageRef adtcore:name="ZP"/><mc:messages mc:msgno="001" mc:msgtext="T1" mc:selfexplainatory="true" adtcore:description="D1"/></mc:messageClass>`;

const LOCK = (h: string) =>
  `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>${h}</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

function recorder(classXml = CLASS_XML) {
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
        return { data: classXml, status: 200, headers: {} } as IAdtResponse;
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

  it('appends &corrNr= on the class PUT when transportRequest is set', async () => {
    const { conn, calls } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    await m.update({
      className: 'ZT',
      msgno: '001',
      msgtext: 'NEW',
      transportRequest: 'DEVK900001',
    });
    const put = calls.find((c) => c.method === 'PUT');
    expect(put.url).toContain('lockHandle=');
    expect(put.url).toContain('&corrNr=DEVK900001');
  });

  it('delete: <mc:deletedmessages> for target + lockhandle; kept messages in <mc:messages>; correct lock chain; no HTTP DELETE', async () => {
    const { conn, calls } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    await m.delete({ className: 'ZT', msgno: '001' });

    const urls = calls.map((c) => `${c.method} ${c.url}`);
    // Lock chain mirrors create/update: LOCK_MSG + class LOCK (msgNo + onSave) + UNLOCK + UNLOCK_ALL
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
    expect(urls.some((u) => u.includes('?_action=UNLOCK'))).toBe(true);
    expect(
      urls.some((u) => u.includes('/messages/001?_action=UNLOCK_ALL')),
    ).toBe(true);

    // PUT body: 001 in <mc:deletedmessages> with its message lock handle
    const put = calls.find((c) => c.method === 'PUT');
    const body = String(put.data);
    expect(body).toMatch(/<mc:deletedmessages[^>]*mc:msgno="001"/);
    expect(body).toMatch(/<mc:deletedmessages[^>]*mc:lockhandle="MH"/);

    // 002 stays as a regular <mc:messages> entry (not deleted)
    expect(body).toMatch(/<mc:messages[^>]*mc:msgno="002"/);
    expect(body).not.toMatch(/<mc:deletedmessages[^>]*mc:msgno="002"/);

    // No HTTP-level DELETE — message-level DELETE /messages/{no} returns 423 and is never used
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
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

  it('upsert with selfExplanatory+description: PUT body emits mc:selfexplainatory and adtcore:description', async () => {
    const { conn, calls } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    await m.update({
      className: 'ZT',
      msgno: '001',
      msgtext: 'NEW',
      selfExplanatory: true,
      description: 'X',
    });
    const put = calls.find((c) => c.method === 'PUT');
    const body = String(put.data);
    expect(body).toContain('mc:selfexplainatory="true"');
    expect(body).toContain('adtcore:description="X"');
  });

  it('existing selfExplanatory+description round-trip when not overridden in update', async () => {
    // CLASS_XML_WITH_FLAGS has 001 with selfexplainatory="true" and description="D1"
    const { conn, calls } = recorder(CLASS_XML_WITH_FLAGS);
    const m = new AdtMessageClassMessage(conn, noopLogger);
    // Update only msgtext — selfExplanatory and description not specified
    await m.update({ className: 'ZT', msgno: '001', msgtext: 'UPDATED' });
    const put = calls.find((c) => c.method === 'PUT');
    const body = String(put.data);
    expect(body).toContain('mc:msgtext="UPDATED"');
    // Existing values preserved via rawAttrs round-trip
    expect(body).toContain('mc:selfexplainatory="true"');
    expect(body).toContain('adtcore:description="D1"');
  });

  it('create new message with selfExplanatory+description: PUT body emits both fields', async () => {
    const { conn, calls } = recorder();
    const m = new AdtMessageClassMessage(conn, noopLogger);
    // 003 does not exist in CLASS_XML — it will be pushed as a new message
    await m.create({
      className: 'ZT',
      msgno: '003',
      msgtext: 'BRAND NEW',
      selfExplanatory: false,
      description: 'New message desc',
    });
    const put = calls.find((c) => c.method === 'PUT');
    const body = String(put.data);
    expect(body).toContain('mc:msgno="003"');
    expect(body).toContain('mc:selfexplainatory="false"');
    expect(body).toContain('adtcore:description="New message desc"');
  });
});
