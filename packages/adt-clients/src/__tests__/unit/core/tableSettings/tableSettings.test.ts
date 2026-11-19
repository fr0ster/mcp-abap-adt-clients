/**
 * `getTableSettings()` over the recorded answers of the table settings
 * research (`corpus/adt/answers/*table-settings*`, 2026-11-19): the read on
 * premise and on the cloud, the write's request and body, and SAP's refusal of
 * a document without a description — each member one request, as sent.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readTableSettings, tableSettings } from '@mcp-abap-adt/adt-strategies';
import {
  ADT_NO_FAILURE,
  type ITableSettingsUpdateConfig,
} from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../../clients/AdtClient';
import { tableSettingsDocument } from '../../../../core/tableSettings/document';
import { recogniseFailure } from '../../../../utils/adtResponse';
import { headersOf } from '../../../helpers/adtHeaders';

const ANSWERS = path.resolve(__dirname, '../../../../../corpus/adt/answers');

/** A recorded exchange: the sidecar's status and headers, and its body. */
function recorded(caseStep: string): IAdtWireResponse {
  const sidecar = JSON.parse(
    fs.readFileSync(path.join(ANSWERS, `${caseStep}.json`), 'utf8'),
  );
  return {
    status: sidecar.response.status,
    statusText: sidecar.response.statusText,
    headers: sidecar.response.headers,
    data: fs.readFileSync(
      path.join(ANSWERS, sidecar.response.bodyFile),
      'utf8',
    ),
  } as IAdtWireResponse;
}

/** A connection that answers `answer` and records every request and session switch. */
function recording(answer: IAdtWireResponse) {
  const requests: IAbapRequestOptions[] = [];
  const sessions: string[] = [];
  const connection = {
    setSessionType: (type: string) => sessions.push(type),
    isConnected: () => true,
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      requests.push(options);
      if (answer.status >= 400) {
        // The connector rejects a failed status with the answer attached.
        throw {
          message: `Request failed with status code ${answer.status}`,
          response: answer,
        };
      }
      return answer;
    },
  } as unknown as IAbapConnection;
  return { connection, requests, sessions };
}

const OK = { status: 200, statusText: 'OK', headers: {}, data: '' };

const CHANGED: ITableSettingsUpdateConfig = {
  tableName: 'zmcp_ts_3182',
  description: 'MCP table settings trial',
  transportRequest: 'DEVK900001',
  settings: {
    dataClassCategory: 'APPL1',
    sizeCategory: '1',
    buffering: { allowed: 'X', type: 'G', areaKeyFields: 1 },
    storageType: 'C',
    sharingType: '',
    loadUnit: '',
    translation: {
      value: '',
      isVisible: false,
      isEditable: false,
      granularity: '2',
    },
    loggingEnabled: true,
  },
};

describe.each([
  ['s4-2025', 'sflight', 'APPL1'],
  ['abap-cloud', 'z0001flight', 'APPL0'],
])('the settings read (%s)', (release, table, dataClass) => {
  it('GETs /ddic/db/settings/{name} with the v2 Accept and answers the document as it arrived', async () => {
    const answer = recorded(`read-table-settings-${release}--01-settings`);
    const { connection, requests } = recording(answer);
    const read = await new AdtClient(connection)
      .getTableSettings()
      .readMetadata({ tableName: table.toUpperCase() });

    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe('GET');
    expect(requests[0]?.url).toBe(`/sap/bc/adt/ddic/db/settings/${table}`);
    expect(requests[0]?.headers?.Accept).toBe(
      'application/vnd.sap.adt.table.settings.v2+xml',
    );
    expect(read.ok).toBe(true);
    expect(read.ok && read.getResult().value).toBe(answer.data);
    expect(answer.data).toContain(
      `<ts:dataClassCategory>${dataClass}</ts:dataClassCategory>`,
    );
  });
});

describe('the cloud read', () => {
  it('carries ts:isWritableByAMDP, which only a read returns', () => {
    expect(
      String(recorded('read-table-settings-abap-cloud--01-settings').data),
    ).toContain('<ts:isWritableByAMDP>false</ts:isWritableByAMDP>');
  });
});

describe('the settings write', () => {
  it('PUTs the settings with lockHandle and corrNr, the v2 content type and every setting', async () => {
    const { connection, requests } = recording(
      recorded('write-table-settings-s4-2025--01-update'),
    );
    const settings = new AdtClient(connection).getTableSettings();
    const headers = headersOf(settings, 'updateMetadata');
    const written = await settings.updateMetadata(CHANGED, {
      headers,
      lockHandle: 'LH/1',
    });

    expect(written.ok).toBe(true);
    expect(requests).toHaveLength(1);
    const [put] = requests;
    expect(put?.method).toBe('PUT');
    expect(put?.url).toBe(
      '/sap/bc/adt/ddic/db/settings/zmcp_ts_3182?lockHandle=LH%2F1&corrNr=DEVK900001',
    );
    expect(put?.headers?.['Content-Type']).toBe(
      'application/vnd.sap.adt.table.settings.v2+xml; charset=utf-8',
    );
    expect(put?.headers?.Accept).toBe(
      'application/vnd.sap.adt.table.settings.v2+xml',
    );
    expect(put?.data).toBe(tableSettingsDocument(CHANGED));
  });

  it('sends no corrNr without a transport request', async () => {
    const { connection, requests } = recording(OK);
    const settings = new AdtClient(connection).getTableSettings();
    await settings.updateMetadata(
      { ...CHANGED, transportRequest: undefined },
      { headers: headersOf(settings, 'updateMetadata'), lockHandle: 'LH' },
    );
    expect(requests[0]?.url).toBe(
      '/sap/bc/adt/ddic/db/settings/zmcp_ts_3182?lockHandle=LH',
    );
  });

  it('sends If-Match when the caller gives the read ETag, the charset dropped as the ETag of SAP requires', async () => {
    const { connection, requests } = recording(OK);
    const settings = new AdtClient(connection).getTableSettings();
    await settings.updateMetadata(CHANGED, {
      headers: headersOf(settings, 'updateMetadata'),
      lockHandle: 'LH',
      ifMatch: 'ETAG-1',
    });
    expect(requests[0]?.headers?.['If-Match']).toBe('ETAG-1');
    expect(requests[0]?.headers?.['Content-Type']).toBe(
      // The settings' ETag carries the media type without the charset: a
      // guarded PUT with `; charset=utf-8` is refused 412 SADT_RESOURCE/043,
      // without it accepted (measured on premise and on the cloud, 2026-11-19).
      'application/vnd.sap.adt.table.settings.v2+xml',
    );
  });

  it("propagates SAP's 400 SWB_TOOL 019 as a failure, its answer kept, after sending the description it was given", async () => {
    // The recorded 400 answered a document carrying no adtcore:description at
    // all (the fixture's sidecar says so); the contract requires one, so the
    // write sends what it is given — here an empty one — and SAP's answer is
    // passed on as the failure.
    const answer = recorded(
      'refusal-table-settings-no-description-s4-2025--01-update',
    );
    const { connection, requests } = recording(answer);
    const settings = new AdtClient(connection).getTableSettings();
    const written = await settings.updateMetadata(
      { ...CHANGED, description: '' },
      { headers: headersOf(settings, 'updateMetadata'), lockHandle: 'LH' },
    );
    expect(requests).toHaveLength(1);
    expect(requests[0]?.data).toBe(
      tableSettingsDocument({ ...CHANGED, description: '' }),
    );
    expect(String(requests[0]?.data)).toContain('adtcore:description=""');
    expect(written.ok).toBe(false);
    const failure = !written.ok ? written.getError() : undefined;
    expect(failure?.response?.status).toBe(400);
    expect(String(failure?.response?.data)).toContain(
      'The description is missing',
    );
  });
});

describe('the settings document', () => {
  const body = tableSettingsDocument(CHANGED);

  it('names the table and carries its description', () => {
    expect(body).toContain('adtcore:name="ZMCP_TS_3182"');
    expect(body).toContain('adtcore:type="TABL/DTT"');
    expect(body).toContain('adtcore:description="MCP table settings trial"');
  });

  it("writes every setting, in the transformation's order", () => {
    const order = [
      '<ts:dataClassCategory>APPL1</ts:dataClassCategory>',
      '<ts:sizeCategory>1</ts:sizeCategory>',
      '<ts:buffering><ts:allowed>X</ts:allowed><ts:type>G</ts:type><ts:areaKeyFields>1</ts:areaKeyFields></ts:buffering>',
      '<ts:storageType>C</ts:storageType>',
      '<ts:sharingType/>',
      '<ts:loadUnit/>',
      '<ts:translation ts:value="" ts:isVisible="false" ts:isEditable="false" ts:granularity="2"/>',
      '<ts:loggingEnabled>true</ts:loggingEnabled>',
    ];
    let at = -1;
    for (const part of order) {
      const next = body.indexOf(part);
      expect(next).toBeGreaterThan(at);
      at = next;
    }
  });

  it('never writes ts:isWritableByAMDP, even when a read result is passed back as it is', () => {
    const fromARead = {
      ...CHANGED,
      settings: { ...CHANGED.settings, isWritableByAMDP: true },
    } as unknown as ITableSettingsUpdateConfig;
    expect(tableSettingsDocument(fromARead)).not.toContain('isWritableByAMDP');
  });

  it('escapes the description and the codes', () => {
    const escaped = tableSettingsDocument({
      ...CHANGED,
      description: 'A & "B" <C>',
      settings: { ...CHANGED.settings, storageType: '<&>' },
    });
    expect(escaped).toContain(
      'adtcore:description="A &amp; &quot;B&quot; &lt;C&gt;"',
    );
    expect(escaped).toContain('<ts:storageType>&lt;&amp;&gt;</ts:storageType>');
  });
});

describe('the settings lock', () => {
  it('LOCKs stateful with accessMode=MODIFY and UNLOCKs stateful with the handle', async () => {
    const { connection, requests, sessions } = recording({
      ...OK,
      data: '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH/1</LOCK_HANDLE></DATA></asx:values></asx:abap>',
    });
    const settings = new AdtClient(connection).getTableSettings();
    const locked = await settings.lock({ tableName: 'ZMCP_TS_3182' });
    expect(locked.ok && locked.getResult().value).toBe('LH/1');
    await settings.unlock({ tableName: 'ZMCP_TS_3182' }, 'LH/1');

    expect(requests.map((r) => [r.method, r.url])).toEqual([
      [
        'POST',
        '/sap/bc/adt/ddic/db/settings/zmcp_ts_3182?_action=LOCK&accessMode=MODIFY',
      ],
      [
        'POST',
        '/sap/bc/adt/ddic/db/settings/zmcp_ts_3182?_action=UNLOCK&lockHandle=LH%2F1',
      ],
    ]);
    expect(sessions).toEqual([
      'stateful',
      'stateless',
      'stateful',
      'stateless',
    ]);
  });
});

/** A connection answering each request in turn; a status of 400 or more rejects. */
function sequence(answers: IAdtWireResponse[]) {
  const requests: IAbapRequestOptions[] = [];
  const connection = {
    setSessionType: () => {},
    isConnected: () => true,
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      requests.push(options);
      const answer = answers.shift() ?? OK;
      if (answer.status >= 400) {
        throw {
          message: `Request failed with status code ${answer.status}`,
          response: answer,
        };
      }
      return answer;
    },
  } as unknown as IAbapConnection;
  return { connection, requests };
}

const LOCKED = {
  ...OK,
  data: '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE>LH/1</LOCK_HANDLE></DATA></asx:values></asx:abap>',
};
const REFUSED = {
  status: 500,
  statusText: 'Internal Server Error',
  headers: {},
  data: '',
};

describe('a read written back', () => {
  it('round-trips character references and edge spaces value for value, escaped once', () => {
    const xml = String(
      recorded('read-table-settings-s4-2025--01-settings').data,
    )
      .replace(
        'adtcore:description="Flight"',
        'adtcore:description=" Caf&#xE9; &amp; &lt;x&gt; "',
      )
      .replace('ts:value=""', 'ts:value="  Caf&#xE9; "');
    const read = readTableSettings(xml);
    expect(read.description).toBe(' Caf\u00e9 & <x> ');
    expect(read.settings.translation.value).toBe('  Caf\u00e9 ');
    const { isWritableByAMDP: _readOnly, ...asRead } = read.settings;
    const body = tableSettingsDocument({
      tableName: read.name,
      description: read.description,
      settings: asRead,
    });
    expect(body).toContain('adtcore:description=" Caf\u00e9 &amp; &lt;x&gt; "');
    expect(body).toContain('ts:value="  Caf\u00e9 "');
    const again = readTableSettings(
      body.replace(
        'adtcore:type="TABL/DTT"',
        'adtcore:type="TABL/DTT" adtcore:version="inactive"',
      ),
    );
    expect(again.description).toBe(read.description);
    expect(again.settings).toEqual(asRead);
  });

  it.each(['s4-2025', 'abap-cloud'])(
    'carries every setting as read, the translation with its four attributes (%s)',
    (release) => {
      const answer = recorded(`read-table-settings-${release}--01-settings`);
      const read = tableSettings(answer);
      const { isWritableByAMDP: _readOnly, ...asRead } = read.settings;
      const body = tableSettingsDocument({
        tableName: read.name,
        description: read.description,
        settings: asRead,
      });
      expect(body).toContain(
        '<ts:translation ts:value="" ts:isVisible="false" ts:isEditable="false" ts:granularity="2"/>',
      );
      // Every setting the read held, but what only a read returns, is written:
      // the document read back with the read's own version gives the same.
      const withVersion = body.replace(
        'adtcore:type="TABL/DTT"',
        `adtcore:type="TABL/DTT" adtcore:version="${read.version}"`,
      );
      expect(readTableSettings(withVersion).settings).toEqual(asRead);
      expect(body).not.toContain('isWritableByAMDP');
    },
  );
});

describe("the settings lock in the client's registry", () => {
  it('keeps the lock when the UNLOCK failed on the wire, even when an analyser calls it ok, and unlockAll() retries it', async () => {
    const { connection, requests } = sequence([LOCKED, REFUSED, OK]);
    const client = new AdtClient(connection);
    const settings = client.getTableSettings();
    await settings.lock({ tableName: 'ZT' });
    const unlocked = await settings.unlock({ tableName: 'ZT' }, 'LH/1', {
      analyse: () => ADT_NO_FAILURE,
    });
    expect(unlocked.ok).toBe(true);
    expect(client.pendingLocks).toEqual(['TableSettings/ZT']);
    expect(await client.unlockAll()).toEqual([]);
    expect(client.pendingLocks).toEqual([]);
    expect(requests.map((r) => r.url)).toEqual([
      '/sap/bc/adt/ddic/db/settings/zt?_action=LOCK&accessMode=MODIFY',
      '/sap/bc/adt/ddic/db/settings/zt?_action=UNLOCK&lockHandle=LH%2F1',
      '/sap/bc/adt/ddic/db/settings/zt?_action=UNLOCK&lockHandle=LH%2F1',
    ]);
  });

  it('keeps the lock when UNLOCK fails, so unlockAll() can try again', async () => {
    const { connection } = sequence([LOCKED, REFUSED]);
    const client = new AdtClient(connection);
    const settings = client.getTableSettings();
    await settings.lock({ tableName: 'ZT' });
    const unlocked = await settings.unlock({ tableName: 'ZT' }, 'LH/1');
    expect(unlocked.ok).toBe(false);
    expect(client.pendingLocks).toEqual(['TableSettings/ZT']);
  });

  it('drops the lock after a successful UNLOCK', async () => {
    const { connection } = sequence([LOCKED, OK]);
    const client = new AdtClient(connection);
    const settings = client.getTableSettings();
    await settings.lock({ tableName: 'ZT' });
    const unlocked = await settings.unlock({ tableName: 'ZT' }, 'LH/1');
    expect(unlocked.ok).toBe(true);
    expect(client.pendingLocks).toEqual([]);
  });
});

describe('the registry follows the wire, not analyse', () => {
  it('tracks a 200 with a handle that an analyser calls a failure, so unlockAll() releases it', async () => {
    const { connection, requests } = sequence([LOCKED, OK]);
    const client = new AdtClient(connection);
    const locked = await client.getTableSettings().lock(
      { tableName: 'ZT' },
      {
        analyse: () => ({ origin: 'refusal', message: 'the caller says no' }),
      },
    );
    expect(locked.ok).toBe(false);
    expect(client.pendingLocks).toEqual(['TableSettings/ZT']);
    expect(await client.unlockAll()).toEqual([]);
    expect(client.pendingLocks).toEqual([]);
    expect(requests.map((r) => r.url)[1]).toBe(
      '/sap/bc/adt/ddic/db/settings/zt?_action=UNLOCK&lockHandle=LH%2F1',
    );
  });

  it('keeps the lock when the UNLOCK resolved 403, and unlockAll() retries it', async () => {
    const resolved403 = { ...REFUSED, status: 403, statusText: 'Forbidden' };
    const requests: IAbapRequestOptions[] = [];
    const answers = [LOCKED, resolved403, OK];
    const connection = {
      setSessionType: () => {},
      isConnected: () => true,
      // A connection that resolves every status, the failed ones included.
      makeAdtRequest: async (options: IAbapRequestOptions) => {
        requests.push(options);
        return answers.shift() ?? OK;
      },
    } as unknown as IAbapConnection;
    const client = new AdtClient(connection);
    const settings = client.getTableSettings();
    await settings.lock({ tableName: 'ZT' });
    await settings.unlock({ tableName: 'ZT' }, 'LH/1');
    expect(client.pendingLocks).toEqual(['TableSettings/ZT']);
    expect(await client.unlockAll()).toEqual([]);
    expect(client.pendingLocks).toEqual([]);
    expect(requests).toHaveLength(3);
  });
});

/** A connection that resolves every answer, refusals included. */
function resolving(answers: IAdtWireResponse[]) {
  const requests: IAbapRequestOptions[] = [];
  const connection = {
    setSessionType: () => {},
    isConnected: () => true,
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      requests.push(options);
      return answers.shift() ?? OK;
    },
  } as unknown as IAbapConnection;
  return { connection, requests };
}

describe('the default analysis of a refusal a connection resolved', () => {
  it('answers a resolved PUT 412 as a failure', async () => {
    const { connection } = resolving([
      { status: 412, statusText: 'Precondition Failed', headers: {}, data: '' },
    ]);
    const settings = new AdtClient(connection).getTableSettings();
    const written = await settings.updateMetadata(CHANGED, {
      headers: headersOf(settings, 'updateMetadata'),
      lockHandle: 'LH',
      ifMatch: 'E-1',
    });
    expect(written.ok).toBe(false);
    expect(!written.ok && written.getError().response?.status).toBe(412);
  });

  it('answers a resolved UNLOCK 403 as a failure', async () => {
    const { connection } = resolving([
      LOCKED,
      { status: 403, statusText: 'Forbidden', headers: {}, data: '' },
    ]);
    const settings = new AdtClient(connection).getTableSettings();
    await settings.lock({ tableName: 'ZT' });
    const unlocked = await settings.unlock({ tableName: 'ZT' }, 'LH/1');
    expect(unlocked.ok).toBe(false);
  });
});

describe('the registry is updated before any analyse runs', () => {
  const throwing = () => {
    throw new Error("the caller's analyser threw");
  };

  it('tracks a 2xx LOCK with a handle even when the analyser throws', async () => {
    const { connection } = sequence([LOCKED]);
    const client = new AdtClient(connection);
    await expect(
      client
        .getTableSettings()
        .lock({ tableName: 'ZT' }, { analyse: throwing }),
    ).rejects.toThrow('analyser threw');
    expect(client.pendingLocks).toEqual(['TableSettings/ZT']);
  });

  it('untracks a 2xx UNLOCK even when the analyser throws', async () => {
    const { connection } = sequence([LOCKED, OK]);
    const client = new AdtClient(connection);
    const settings = client.getTableSettings();
    await settings.lock({ tableName: 'ZT' });
    await expect(
      settings.unlock({ tableName: 'ZT' }, 'LH/1', { analyse: throwing }),
    ).rejects.toThrow('analyser threw');
    expect(client.pendingLocks).toEqual([]);
  });
});

describe('a lock without a handle', () => {
  it('is a refusal (LOCK_FAILED), its answer kept, and nothing is tracked', async () => {
    const empty = {
      ...OK,
      data: '<asx:abap xmlns:asx="http://www.sap.com/abapxml"><asx:values><DATA><LOCK_HANDLE/></DATA></asx:values></asx:abap>',
    };
    const { connection } = sequence([empty]);
    const client = new AdtClient(connection);
    const locked = await client.getTableSettings().lock({ tableName: 'ZT' });
    expect(locked.ok).toBe(false);
    const failure = !locked.ok ? locked.getError() : undefined;
    expect(failure?.code).toBe('ADT_LOCK_FAILED');
    expect(failure?.response?.status).toBe(200);
    expect(failure?.response?.data).toBe(empty.data);
    expect(client.pendingLocks).toEqual([]);
  });

  it("a LOCK SAP refused and the connection resolved keeps SAP's classification, not LOCK_FAILED", async () => {
    const refused = recorded('refusal-lock-held-by-other--01-lock');
    const connection = {
      setSessionType: () => undefined,
      isConnected: () => true,
      makeAdtRequest: async () => refused,
    } as unknown as IAbapConnection;
    const client = new AdtClient(connection);
    const locked = await client.getTableSettings().lock({ tableName: 'ZT' });
    expect(locked.ok).toBe(false);
    const failure = !locked.ok ? locked.getError() : undefined;
    expect(failure?.code).not.toBe('ADT_LOCK_FAILED');
    expect(failure?.response?.status).toBe(403);
    // The verdict every member gives a refusal a connection resolved: the
    // one it would have had thrown, with SAP's answer as its response.
    expect(failure).toEqual(
      recogniseFailure({
        message: 'Request failed with status code 403',
        response: failure?.response,
      }),
    );
    expect(client.pendingLocks).toEqual([]);
  });

  it('is refused by the write before any request: an empty lockHandle never leaves the PUT', async () => {
    const { connection, requests } = sequence([]);
    const settings = new AdtClient(connection).getTableSettings();
    await expect(
      settings.updateMetadata(CHANGED, {
        headers: headersOf(settings, 'updateMetadata'),
        lockHandle: '',
      }),
    ).rejects.toThrow('lockHandle');
    expect(requests).toEqual([]);
  });
});

describe('AdtClient.getTableSettings', () => {
  it('returns a handler whose objectType is TableSettings', () => {
    const { connection } = recording(OK);
    expect(new AdtClient(connection).getTableSettings().objectType).toBe(
      'TableSettings',
    );
  });
});
