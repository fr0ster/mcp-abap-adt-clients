import type { IAbapConnection, IAdtResponse } from '@mcp-abap-adt/interfaces';
import { AdtMessageClass } from '../../core/messageClass/AdtMessageClass';
import { noopLogger } from '../../utils/noopLogger';

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
  handler: (call: Recorded, index: number) => Promise<IAdtResponse>,
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

function conn(handler: (o: any) => Promise<IAdtResponse>): IAbapConnection {
  return {
    makeAdtRequest: handler,
    setSessionType: () => {},
  } as unknown as IAbapConnection;
}

// ---------- tests ----------

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

  it('validate POSTs to /messageclass/validation with objname + description', async () => {
    let seen: any;
    const mc = new AdtMessageClass(
      conn(async (o) => {
        seen = o;
        return { data: '', status: 200, headers: {} } as IAdtResponse;
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
        return { data: '', status: 201, headers: {} } as IAdtResponse;
      }),
      noopLogger,
    );
    await mc.create({ name: 'ZT', description: 'D', packageName: 'ZP' });
    expect(String(seen.data)).toContain('adtcore:masterLanguage="EN"');
  });

  it('create POST body uses the masterLanguage from config when provided', async () => {
    let seen: any;
    const mc = new AdtMessageClass(
      conn(async (o) => {
        seen = o;
        return { data: '', status: 201, headers: {} } as IAdtResponse;
      }),
      noopLogger,
    );
    await mc.create({
      name: 'ZT',
      description: 'D',
      packageName: 'ZP',
      masterLanguage: 'DE',
    });
    expect(String(seen.data)).toContain('adtcore:masterLanguage="DE"');
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

  it('activate/check/getVersions/getVersionSource throw UNSUPPORTED', async () => {
    const mc = new AdtMessageClass(
      conn(async () => ({}) as IAdtResponse),
      noopLogger,
    );
    for (const fn of [
      () => mc.activate({ name: 'ZT' }),
      () => mc.check({ name: 'ZT' }),
      () => mc.getVersions({ name: 'ZT' }),
      () => mc.getVersionSource('any-uri'),
    ]) {
      await expect(fn()).rejects.toMatchObject({
        code: 'ADT_UNSUPPORTED_OPERATION',
      });
    }
  });

  it('update: LOCK→GET(read)→PUT(preserves msg)→UNLOCK sequence', async () => {
    const {
      conn: c,
      calls,
      sessionTypes,
    } = recorder(async (rec, idx) => {
      // idx 0: LOCK POST → return lock XML
      if (idx === 0)
        return { data: LOCK_XML, status: 200, headers: {} } as IAdtResponse;
      // idx 1: GET (read current inside updateMessageClass) → return XML with msg 001
      if (idx === 1)
        return {
          data: CLASS_XML_WITH_MSG,
          status: 200,
          headers: {},
        } as IAdtResponse;
      // idx 2: PUT
      if (idx === 2)
        return { data: '', status: 200, headers: {} } as IAdtResponse;
      // idx 3: UNLOCK POST
      return { data: '', status: 200, headers: {} } as IAdtResponse;
    });

    const mc = new AdtMessageClass(c, noopLogger);
    await mc.update({ name: 'ZT', description: 'NEW' });

    // Sequence: LOCK → GET (read) → PUT → UNLOCK
    expect(calls).toHaveLength(4);

    // call[0]: LOCK
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toContain('_action=LOCK');
    expect(calls[0].url).toContain('accessMode=MODIFY');

    // call[1]: GET (read inside updateMessageClass)
    expect(calls[1].method).toBe('GET');
    expect(calls[1].url).toContain('/sap/bc/adt/messageclass/');

    // call[2]: PUT with lockHandle; body must carry NEW description AND preserved msg 001
    expect(calls[2].method).toBe('PUT');
    expect(calls[2].url).toContain('lockHandle=');
    const putBody = String(calls[2].data);
    expect(putBody).toContain('NEW');
    expect(putBody).toContain('mc:msgno="001"');

    // call[3]: UNLOCK
    expect(calls[3].method).toBe('POST');
    expect(calls[3].url).toContain('_action=UNLOCK');

    // session: stateful before lock, stateless after unlock
    expect(sessionTypes[0]).toBe('stateful');
    expect(sessionTypes[sessionTypes.length - 1]).toBe('stateless');
  });

  it('delete: stateless deletion service (check → delete), no lock/DELETE', async () => {
    const { conn: c, calls } = recorder(
      async () => ({ data: '', status: 200, headers: {} }) as IAdtResponse,
    );

    const mc = new AdtMessageClass(c, noopLogger);
    await mc.delete({ name: 'ZT' });

    expect(calls).toHaveLength(2);

    // call[0]: deletion check
    expect(calls[0].method).toBe('POST');
    expect(calls[0].url).toBe('/sap/bc/adt/deletion/check');
    expect(String(calls[0].data)).toContain(
      'adtcore:uri="/sap/bc/adt/messageclass/zt"',
    );

    // call[1]: deletion delete (stateless service, NOT a direct DELETE)
    expect(calls[1].method).toBe('POST');
    expect(calls[1].url).toBe('/sap/bc/adt/deletion/delete');
    expect(String(calls[1].data)).toContain('del:deletionRequest');

    // no direct object DELETE, no lock cycle
    expect(calls.some((c2) => c2.method === 'DELETE')).toBe(false);
    expect(calls.some((c2) => String(c2.url).includes('_action=LOCK'))).toBe(
      false,
    );
  });

  it('update error-cleanup: UNLOCK + stateless called even if PUT throws', async () => {
    const {
      conn: c,
      calls,
      sessionTypes,
    } = recorder(async (_rec, idx) => {
      if (idx === 0)
        return { data: LOCK_XML, status: 200, headers: {} } as IAdtResponse;
      if (idx === 1)
        return {
          data: CLASS_XML_WITH_MSG,
          status: 200,
          headers: {},
        } as IAdtResponse;
      if (idx === 2)
        throw Object.assign(new Error('PUT failed'), {
          response: { status: 500 },
        });
      // idx 3: UNLOCK (called during error cleanup)
      return { data: '', status: 200, headers: {} } as IAdtResponse;
    });

    const mc = new AdtMessageClass(c, noopLogger);
    await expect(mc.update({ name: 'ZT', description: 'NEW' })).rejects.toThrow(
      'PUT failed',
    );

    // UNLOCK must still have been called (call index 3)
    expect(calls).toHaveLength(4);
    expect(calls[3].method).toBe('POST');
    expect(calls[3].url).toContain('_action=UNLOCK');

    // stateless must be set after cleanup
    expect(sessionTypes).toContain('stateless');
  });
});
