/**
 * `getTableSettings()` over the recorded answers of the table settings
 * research (`corpus/adt/answers/*table-settings*`, 2026-11-19): the read on
 * premise and on the cloud, the write's request and body, and SAP's refusal of
 * a document without a description — each member one request, as sent.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ITableSettingsUpdateConfig } from '@mcp-abap-adt/interfaces-adt';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../../clients/AdtClient';
import { tableSettingsDocument } from '../../../../core/tableSettings/document';
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
    translation: '',
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

  it('sends If-Match when the caller gives the read ETag', async () => {
    const { connection, requests } = recording(OK);
    const settings = new AdtClient(connection).getTableSettings();
    await settings.updateMetadata(CHANGED, {
      headers: headersOf(settings, 'updateMetadata'),
      lockHandle: 'LH',
      ifMatch: 'ETAG-1',
    });
    expect(requests[0]?.headers?.['If-Match']).toBe('ETAG-1');
  });

  it('answers SAP refusing a document without a description (400, SWB_TOOL 019) as a failure, its answer kept', async () => {
    const answer = recorded(
      'refusal-table-settings-no-description-s4-2025--01-update',
    );
    const { connection } = recording(answer);
    const settings = new AdtClient(connection).getTableSettings();
    const written = await settings.updateMetadata(
      { ...CHANGED, description: '' },
      { headers: headersOf(settings, 'updateMetadata'), lockHandle: 'LH' },
    );
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
      '<ts:translation ts:value=""/>',
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

describe('AdtClient.getTableSettings', () => {
  it('returns a handler whose objectType is TableSettings', () => {
    const { connection } = recording(OK);
    expect(new AdtClient(connection).getTableSettings().objectType).toBe(
      'TableSettings',
    );
  });
});
