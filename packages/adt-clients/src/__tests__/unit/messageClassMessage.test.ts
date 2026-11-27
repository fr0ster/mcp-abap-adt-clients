import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtMessageClassMessage } from '../../core/messageClass/AdtMessageClassMessage';
import { messageDocuments } from '../../core/messageClass/types';
import { parseMessageClass } from '../../core/messageClass/xml';
import { noopLogger } from '../../utils/noopLogger';
import { headersOf } from '../helpers/adtHeaders';
import { expectResult } from '../helpers/contract';

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
        return {
          data: LOCK('MH'),
          status: 200,
          headers: {},
        } as IAdtWireResponse;
      if (String(o.url).includes('_action=LOCK'))
        return {
          data: LOCK('CH'),
          status: 200,
          headers: {},
        } as IAdtWireResponse;
      if (o.method === 'GET')
        return { data: classXml, status: 200, headers: {} } as IAdtWireResponse;
      return { data: '', status: 200, headers: {} } as IAdtWireResponse;
    },
  } as unknown as IAbapConnection;
  return { conn, calls };
}

/** The update's options: the class document and both handles (C7 of #304). */
function under(m: AdtMessageClassMessage, classDocument = CLASS_XML) {
  return {
    headers: headersOf(m, 'update'),
    classDocument,
    classLockHandle: 'CH',
    messageLockHandle: 'MH',
  };
}

function handler(classXml = CLASS_XML) {
  const { conn, calls } = recorder(classXml);
  const m = new AdtMessageClassMessage(conn, {
    logger: noopLogger,
    results: messageDocuments,
  });
  return { m, calls };
}

describe('AdtMessageClassMessage', () => {
  it('reads the class document the message lives in', async () => {
    const { m } = handler();
    // There is no resource for one message: it is read through its class's
    // document, so that document is what comes back.
    const document = expectResult(
      await m.read({ className: 'ZT', msgno: '001' }),
      'read message 001',
    );
    expect(parseMessageClass(document).messages).toContainEqual(
      expect.objectContaining({ msgno: '001', msgtext: 'T1' }),
    );
  });

  it('update is one PUT of the full class, under both handles', async () => {
    const { m, calls } = handler();
    await m.update({ className: 'ZT', msgno: '001', msgtext: 'NEW' }, under(m));
    expect(calls).toHaveLength(1);
    const [put] = calls;
    expect(put.method).toBe('PUT');
    expect(put.url).toContain('lockHandle=CH');
    expect(String(put.data)).toContain('mc:msgtext="NEW"');
    expect(String(put.data)).toContain('mc:lockhandle="MH"');
    expect(String(put.data)).toContain('mc:msgno="002"');
  });

  it('appends &corrNr= on the class PUT when transportRequest is set', async () => {
    const { m, calls } = handler();
    await m.update(
      {
        className: 'ZT',
        msgno: '001',
        msgtext: 'NEW',
        transportRequest: 'DEVK900001',
      },
      under(m),
    );
    expect(calls[0].url).toContain('&corrNr=DEVK900001');
  });

  it('a removal appends &corrNr= too', async () => {
    const { m, calls } = handler();
    await m.update(
      {
        className: 'ZT',
        msgno: '001',
        transportRequest: 'DEVK900001',
        removeMessage: true,
      },
      under(m),
    );
    expect(calls[0].url).toContain('&corrNr=DEVK900001');
  });

  it('a removal puts the message in <mc:deletedmessages> with its handle, keeps the others, and sends no DELETE', async () => {
    const { m, calls } = handler();
    await m.update(
      { className: 'ZT', msgno: '001', removeMessage: true },
      under(m),
    );
    expect(calls).toHaveLength(1);
    const body = String(calls[0].data);
    expect(body).toMatch(/<mc:deletedmessages[^>]*mc:msgno="001"/);
    expect(body).toMatch(/<mc:deletedmessages[^>]*mc:lockhandle="MH"/);
    expect(body).toMatch(/<mc:messages[^>]*mc:msgno="002"/);
    expect(body).not.toMatch(/<mc:deletedmessages[^>]*mc:msgno="002"/);
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('carries no method for what a single message cannot do', () => {
    const { m } = handler();
    for (const name of [
      'create',
      'delete',
      'validate',
      'activate',
      'check',
      'readTransport',
      'lock',
      'unlock',
      'getVersions',
      'getVersionSource',
    ]) {
      expect(name in m).toBe(false);
    }
  });

  it('an upsert with selfExplanatory and description writes both', async () => {
    const { m, calls } = handler();
    await m.update(
      {
        className: 'ZT',
        msgno: '001',
        msgtext: 'NEW',
        selfExplanatory: true,
        description: 'X',
      },
      under(m),
    );
    const body = String(calls[0].data);
    expect(body).toContain('mc:selfexplainatory="true"');
    expect(body).toContain('adtcore:description="X"');
  });

  it('keeps an existing selfExplanatory and description it is not told to change', async () => {
    const { m, calls } = handler(CLASS_XML_WITH_FLAGS);
    await m.update(
      { className: 'ZT', msgno: '001', msgtext: 'UPDATED' },
      under(m, CLASS_XML_WITH_FLAGS),
    );
    const body = String(calls[0].data);
    expect(body).toContain('mc:msgtext="UPDATED"');
    expect(body).toContain('mc:selfexplainatory="true"');
    expect(body).toContain('adtcore:description="D1"');
  });

  it('adds a new message with its fields', async () => {
    const { m, calls } = handler();
    await m.update(
      {
        className: 'ZT',
        msgno: '003',
        msgtext: 'BRAND NEW',
        selfExplanatory: false,
        description: 'New message desc',
      },
      under(m),
    );
    const body = String(calls[0].data);
    expect(body).toContain('mc:msgno="003"');
    expect(body).toContain('mc:selfexplainatory="false"');
    expect(body).toContain('adtcore:description="New message desc"');
  });
});
