import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces';
import { parseMessageClass } from '../../core/messageClass';
import { AdtMessageClass } from '../../core/messageClass/AdtMessageClass';
import { noopLogger } from '../../utils/noopLogger';
import { expectFailure, expectResult } from '../helpers/contract';

const CLASS_XML = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N" adtcore:description="D"><adtcore:packageRef adtcore:name="ZP"/></mc:messageClass>`;
const CLASS_XML_WITH_MSG = `<?xml version="1.0"?><mc:messageClass xmlns:mc="http://www.sap.com/adt/MessageClass" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="ZT" adtcore:type="MSAG/N" adtcore:description="OLD"><adtcore:packageRef adtcore:name="ZP"/><mc:messages mc:msgno="001" mc:msgtext="Hello"/></mc:messageClass>`;
const LOCK_XML = `<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH</LOCK_HANDLE></DATA></asx:values></asx:abap>`;

// ---------- helpers ----------

interface Recorded {
  url: string;
  method: string;
  data?: unknown;
}

function recorder(
  handler: (call: Recorded, index: number) => Promise<IAdtWireResponse>,
): { conn: IAbapConnection; calls: Recorded[]; sessionTypes: string[] } {
  const calls: Recorded[] = [];
  const sessionTypes: string[] = [];
  const conn: IAbapConnection = {
    makeAdtRequest: async (o: any) => {
      const rec: Recorded = { url: o.url, method: o.method, data: o.data };
      calls.push(rec);
      return handler(rec, calls.length - 1);
    },
    setSessionType: (t: string) => {
      sessionTypes.push(t);
    },
  } as unknown as IAbapConnection;
  return { conn, calls, sessionTypes };
}

function conn(handler: (o: any) => Promise<IAdtWireResponse>): IAbapConnection {
  return {
    makeAdtRequest: handler,
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

/**
 * A deletion-check answer shaped like the real one.
 *
 * `data: ''` used to be enough because the verdict was discarded. Now that it
 * is read, an empty body means "the server did not approve", which is the
 * correct reading — so the mock has to answer the way ADT does.
 */
const deletionApproved = (name = 'ZT') =>
  `<?xml version="1.0" encoding="UTF-8"?><del:checkResponse xmlns:del="http://www.sap.com/adt/deletion">` +
  `<del:object xmlns:adtcore="http://www.sap.com/adt/core" del:externalStrongReferences="0" ` +
  `del:externalWeakReferences="0" del:isDeletable="true" adtcore:name="${name}" adtcore:type="MSAG/N">` +
  `<del:message del:priority="0" del:type="S"><del:text/></del:message>` +
  `</del:object></del:checkResponse>`;

// ---------- tests ----------

describe('AdtMessageClass', () => {
  it('create POSTs the shell to /messageclass', async () => {
    let seen: any;
    const mc = new AdtMessageClass(
      conn(async (o) => {
        seen = o;
        return { data: '', status: 201, headers: {} } as IAdtWireResponse;
      }),
      noopLogger,
    );
    await mc.create({ name: 'ZT', description: 'D', packageName: 'ZP' });
    expect(seen.url).toContain('/sap/bc/adt/messageclass');
    expect(seen.method).toBe('POST');
    expect(String(seen.data)).toContain('adtcore:type="MSAG/N"');
  });

  it('create adds ?corrNr= when transportRequest is set; omits it otherwise', async () => {
    let seen: any;
    const make = () =>
      new AdtMessageClass(
        conn(async (o) => {
          seen = o;
          return { data: '', status: 201, headers: {} } as IAdtWireResponse;
        }),
        noopLogger,
      );
    await make().create({
      name: 'ZT',
      description: 'D',
      packageName: 'ZP',
      transportRequest: 'DEVK900001',
    });
    expect(seen.url).toBe('/sap/bc/adt/messageclass?corrNr=DEVK900001');

    await make().create({ name: 'ZT', description: 'D', packageName: 'ZP' });
    expect(seen.url).not.toContain('corrNr');
  });

  it('delete emits <del:transportNumber> with the transportRequest', async () => {
    const { conn: c, calls } = recorder(
      async (rec) =>
        ({
          data:
            rec.url === '/sap/bc/adt/deletion/check' ? deletionApproved() : '',
          status: 200,
          headers: {},
        }) as IAdtWireResponse,
    );
    await new AdtMessageClass(c, noopLogger).delete({
      name: 'ZT',
      transportRequest: 'DEVK900001',
    });
    const del = calls.find((x) => x.url === '/sap/bc/adt/deletion/delete');
    expect(String(del?.data)).toContain(
      '<del:transportNumber>DEVK900001</del:transportNumber>',
    );
  });

  it('update carries the handle and the transport it was given', async () => {
    const { conn: c, calls } = recorder(
      async () =>
        ({
          data: CLASS_XML_WITH_MSG,
          status: 200,
          headers: {},
        }) as IAdtWireResponse,
    );
    await new AdtMessageClass(c, noopLogger).updateMetadata(
      { name: 'ZT', description: 'NEW', transportRequest: 'DEVK900001' },
      { lockHandle: 'LOCK_HANDLE_42' },
    );
    const put = calls.find((x) => x.method === 'PUT');
    expect(put?.url).toContain('lockHandle=LOCK_HANDLE_42');
    expect(put?.url).toContain('&corrNr=DEVK900001');
  });

  it('validate POSTs to /messageclass/validation with objname + description', async () => {
    let seen: any;
    const mc = new AdtMessageClass(
      conn(async (o) => {
        seen = o;
        return { data: '', status: 200, headers: {} } as IAdtWireResponse;
      }),
      noopLogger,
    );
    await mc.validate({ name: 'ZT', description: 'Desc' });
    expect(seen.method).toBe('POST');
    expect(seen.url).toContain('/sap/bc/adt/messageclass/validation');
    expect(seen.url).toContain('objname=ZT');
    expect(seen.url).toContain('description=Desc');
  });

  it('create POST body contains adtcore:masterLanguage="EN" by default', async () => {
    let seen: any;
    const mc = new AdtMessageClass(
      conn(async (o) => {
        seen = o;
        return { data: '', status: 201, headers: {} } as IAdtWireResponse;
      }),
      noopLogger,
    );
    await mc.create({ name: 'ZT', description: 'D', packageName: 'ZP' });
    // both adtcore:language and adtcore:masterLanguage default to EN
    expect(String(seen.data)).toContain('adtcore:language="EN"');
    expect(String(seen.data)).toContain('adtcore:masterLanguage="EN"');
  });

  it('create POST body uses the masterLanguage from config when provided', async () => {
    let seen: any;
    const mc = new AdtMessageClass(
      conn(async (o) => {
        seen = o;
        return { data: '', status: 201, headers: {} } as IAdtWireResponse;
      }),
      noopLogger,
    );
    await mc.create({
      name: 'ZT',
      description: 'D',
      packageName: 'ZP',
      masterLanguage: 'DE',
    });
    expect(String(seen.data)).toContain('adtcore:language="DE"');
    expect(String(seen.data)).toContain('adtcore:masterLanguage="DE"');
  });

  it('create falls back to systemContext.masterLanguage when config omits it', async () => {
    let seen: any;
    const mc = new AdtMessageClass(
      conn(async (o) => {
        seen = o;
        return { data: '', status: 201, headers: {} } as IAdtWireResponse;
      }),
      noopLogger,
      { masterLanguage: 'DE' },
    );
    await mc.create({ name: 'ZT', description: 'D', packageName: 'ZP' });
    expect(String(seen.data)).toContain('adtcore:language="DE"');
    expect(String(seen.data)).toContain('adtcore:masterLanguage="DE"');
  });

  it('read GETs /messageclass/{name} and parses', async () => {
    const mc = new AdtMessageClass(
      conn(
        async () =>
          ({ data: CLASS_XML, status: 200, headers: {} }) as IAdtWireResponse,
      ),
      noopLogger,
    );
    // The document, as it arrived. `parseMessageClass` is the reading beside
    // it — the member answers the class, not a shape chosen for the caller.
    const document = expectResult(
      await mc.readMetadata({ name: 'ZT' }),
      'read',
    );
    expect(parseMessageClass(String(document)).name).toBe('ZT');
  });

  it('carries no method for what a message class cannot do', () => {
    // These threw ADT_UNSUPPORTED_OPERATION until they were deleted: a message
    // class is not activated, has no syntax check, no version history, and
    // travels in its package's transport rather than carrying one of its own.
    const mc = new AdtMessageClass(
      conn(async () => ({}) as IAdtWireResponse),
      noopLogger,
    );
    for (const name of [
      'activate',
      'check',
      'getVersions',
      'getVersionSource',
      'readTransport',
    ]) {
      expect(name in mc).toBe(false);
    }
  });

  it('update is GET(read)→PUT, and it preserves the messages it did not touch', async () => {
    const {
      conn: c,
      calls,
      sessionTypes,
    } = recorder(
      async (_rec, idx) =>
        ({
          // The class's own document is a read-modify-write: the description is
          // patched into the XML the server holds, so the messages in it
          // survive. That read is part of building the body, not a step of its
          // own — it addresses the same resource the PUT does.
          data: idx === 0 ? CLASS_XML_WITH_MSG : '',
          status: 200,
          headers: {},
        }) as IAdtWireResponse,
    );

    const mc = new AdtMessageClass(c, noopLogger);
    await mc.updateMetadata(
      { name: 'ZT', description: 'NEW' },
      { lockHandle: 'LOCK_HANDLE_42' },
    );

    expect(calls).toHaveLength(2);

    expect(calls[0].method).toBe('GET');
    expect(calls[0].url).toContain('/sap/bc/adt/messageclass/');

    expect(calls[1].method).toBe('PUT');
    expect(calls[1].url).toContain('lockHandle=LOCK_HANDLE_42');
    const putBody = String(calls[1].data);
    expect(putBody).toContain('NEW');
    expect(putBody).toContain('mc:msgno="001"');

    // No lock, no unlock, and the session untouched: the window is the
    // consumer's to open, and it is the consumer that holds the handle above.
    expect(calls.some((x) => String(x.url).includes('_action='))).toBe(false);
    expect(sessionTypes).toEqual([]);
  });

  it('checkDeletion asks the deletion service, and delete deletes', async () => {
    const { conn: c, calls } = recorder(
      async (rec) =>
        ({
          data:
            rec.url === '/sap/bc/adt/deletion/check' ? deletionApproved() : '',
          status: 200,
          headers: {},
        }) as IAdtWireResponse,
    );

    const mc = new AdtMessageClass(c, noopLogger);

    // Two members, one request each. Whether to ask before deleting is the
    // consumer's call, and it can read the answer to it.
    await mc.checkDeletion({ name: 'ZT' });
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/deletion/check');
    expect(String(calls[0].data)).toContain(
      'adtcore:uri="/sap/bc/adt/messageclass/zt"',
    );

    await mc.delete({ name: 'ZT' });
    expect(calls).toHaveLength(2);
    // The deletion service, not a direct DELETE on the object.
    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toBe('/sap/bc/adt/deletion/delete');
    expect(String(calls[1].data)).toContain('del:deletionRequest');

    expect(calls.some((c2) => c2.method === 'DELETE')).toBe(false);
    expect(calls.some((c2) => String(c2.url).includes('_action=LOCK'))).toBe(
      false,
    );
  });

  it('a refused PUT comes back as the failure it is', async () => {
    const {
      conn: c,
      calls,
      sessionTypes,
    } = recorder(async (_rec, idx) => {
      if (idx === 0)
        return {
          data: CLASS_XML_WITH_MSG,
          status: 200,
          headers: {},
        } as IAdtWireResponse;
      throw Object.assign(new Error('PUT failed'), {
        response: { status: 500 },
      });
    });

    const mc = new AdtMessageClass(c, noopLogger);
    expect(
      expectFailure(
        await mc.updateMetadata(
          { name: 'ZT', description: 'NEW' },
          { lockHandle: 'LOCK_HANDLE_42' },
        ),
        'update whose PUT the server refused',
      ).message,
    ).toContain('PUT failed');

    // Nothing after it: no unlock this member never made, and no session to
    // put back. The handle is the caller's, and so is releasing it.
    expect(calls).toHaveLength(2);
    expect(sessionTypes).toEqual([]);
  });
});
