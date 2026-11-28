/**
 * `patchTableSettings(read, changes, variant)` — the settings change as the caller's
 * three calls (C7, 49.0.0): `readMetadata` (one GET), this patch (no request),
 * `updateMetadata` (one PUT with the read's ETag as `If-Match`).
 *
 * The reads are the recorded ones of both releases
 * (`corpus/adt/answers/read-table-settings-*`), read by adt-strategies'
 * strict readings — `tableSettings` on premise, `cloudTableSettings` on the
 * cloud — as a caller reads them. Each rule of the overlay has a case of its
 * own, with an assertion only that rule makes true.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  cloudTableSettings,
  tableSettings,
} from '@mcp-abap-adt/adt-strategies';
import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../../clients/AdtClient';
import { AdtClientCloud } from '../../../../clients/AdtClientVariants';
import { tableSettingsDocument } from '../../../../core/tableSettings/document';
import { patchTableSettings } from '../../../../core/tableSettings/patch';
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

const ONPREM_ANSWER = recorded('read-table-settings-s4-2025--01-settings');
const CLOUD_ANSWER = recorded('read-table-settings-abap-cloud--01-settings');
const ONPREM = tableSettings(ONPREM_ANSWER);
const CLOUD = cloudTableSettings(CLOUD_ANSWER);

/** A connection answering each request in turn, recording each. */
function sequence(answers: IAdtWireResponse[]) {
  const requests: IAbapRequestOptions[] = [];
  const connection = {
    setSessionType: () => undefined,
    isConnected: () => true,
    makeAdtRequest: async (options: IAbapRequestOptions) => {
      requests.push(options);
      const answer = answers[requests.length - 1];
      if (answer === undefined) throw new Error('no answer left');
      return answer;
    },
  } as unknown as IAbapConnection;
  return { connection, requests };
}

const OK = { status: 200, statusText: 'OK', headers: {}, data: '' };

describe('patchTableSettings', () => {
  it('changes the named setting and keeps every other one and the description as read', () => {
    const patched = patchTableSettings(
      ONPREM,
      { dataClassCategory: 'APPL2' },
      'onprem',
    );
    expect(patched).toEqual({
      ok: true,
      description: ONPREM.description,
      settings: { ...ONPREM.settings, dataClassCategory: 'APPL2' },
    });
  });

  it('on premise answers no isWritableByAMDP, even from a read that carried one', () => {
    const withFlag = {
      ...ONPREM,
      settings: { ...ONPREM.settings, isWritableByAMDP: true },
    };
    const patched = patchTableSettings(
      withFlag,
      { sizeCategory: '2' },
      'onprem',
    );
    expect(patched.ok && 'isWritableByAMDP' in patched.settings).toBe(false);
  });

  it('on premise answers no isWritableByAMDP', () => {
    const patched = patchTableSettings(ONPREM, { sizeCategory: '2' }, 'onprem');
    expect(patched.ok && 'isWritableByAMDP' in patched.settings).toBe(false);
  });

  it('keeps the cloud flag as read when the change does not name it', () => {
    const patched = patchTableSettings(CLOUD, { sizeCategory: '2' }, 'cloud');
    expect(patched.ok && patched.settings.isWritableByAMDP).toBe(
      CLOUD.settings.isWritableByAMDP,
    );
  });

  it('writes the cloud flag a change names', () => {
    const flipped = !CLOUD.settings.isWritableByAMDP;
    const patched = patchTableSettings(
      CLOUD,
      { isWritableByAMDP: flipped },
      'cloud',
    );
    expect(patched.ok && patched.settings.isWritableByAMDP).toBe(flipped);
  });

  it('changes the translation by its value alone, the other attributes as read', () => {
    const patched = patchTableSettings(
      ONPREM,
      { translation: { value: 'B' } },
      'onprem',
    );
    expect(patched.ok && patched.settings.translation).toEqual({
      ...ONPREM.settings.translation,
      value: 'B',
    });
  });

  it('changes buffering field by field and keeps the rest as read', () => {
    const patched = patchTableSettings(
      ONPREM,
      {
        buffering: { type: 'G', areaKeyFields: 2 },
      },
      'onprem',
    );
    expect(patched.ok && patched.settings.buffering).toEqual({
      allowed: ONPREM.settings.buffering.allowed,
      type: 'G',
      areaKeyFields: 2,
    });
  });

  it('sends the area-key count read when none is named, whatever the type', () => {
    // A read of a G table with a count (the recorded one has none): the
    // count read goes back with a type-only change.
    const read = {
      ...ONPREM,
      settings: {
        ...ONPREM.settings,
        buffering: {
          ...ONPREM.settings.buffering,
          type: 'G',
          areaKeyFields: 3,
        },
      },
    };
    const patched = patchTableSettings(
      read,
      { buffering: { type: 'P' } },
      'onprem',
    );
    expect(patched.ok && patched.settings.buffering).toEqual({
      allowed: ONPREM.settings.buffering.allowed,
      type: 'P',
      areaKeyFields: 3,
    });
  });

  it('refuses an areaKeyFields change whose resulting type is not G', () => {
    // The read's type is empty (not buffered): a count without a type
    // compiles, and the merged type is what is refused.
    expect(ONPREM.settings.buffering.type).toBe('');
    const patched = patchTableSettings(
      ONPREM,
      {
        buffering: { areaKeyFields: 2 },
      },
      'onprem',
    );
    expect(patched).toEqual({
      ok: false,
      reason: 'area-key-fields-need-type-g',
      message:
        "areaKeyFields 2 is kept by SAP only with buffering type G; the resulting type is ''",
    });
  });

  it('accepts an areaKeyFields change when the change itself makes the type G', () => {
    const patched = patchTableSettings(
      ONPREM,
      {
        buffering: { type: 'G', areaKeyFields: 1 },
      },
      'onprem',
    );
    expect(patched.ok).toBe(true);
  });

  it('leaves its arguments as they were', () => {
    const before = structuredClone(ONPREM);
    patchTableSettings(
      ONPREM,
      {
        loggingEnabled: !ONPREM.settings.loggingEnabled,
      },
      'onprem',
    );
    expect(ONPREM).toEqual(before);
  });
});

/**
 * The caller's three calls, counted one by one: until 48.0.0 `patchMetadata`
 * sent the GET and the PUT from one member.
 */
describe("the settings change as the caller's three calls", () => {
  it('readMetadata sends one GET, the patch none, updateMetadata one PUT with the ETag read', async () => {
    const { connection, requests } = sequence([ONPREM_ANSWER, OK]);
    const settings = new AdtClient(connection).getTableSettings({
      metadata: tableSettings,
      metadataUpdated: (answer) => answer,
    });

    const read = await settings.readMetadata(
      { tableName: 'SFLIGHT' },
      {
        version: 'inactive',
        accept: headersOf(settings, 'updateMetadata').accept,
      },
    );
    expect(requests.map((r) => [r.method, r.url])).toEqual([
      ['GET', '/sap/bc/adt/ddic/db/settings/sflight?version=inactive'],
    ]);
    if (!read.ok) throw new Error('the read failed');
    const current = read.getResult().value;

    const patched = patchTableSettings(
      current,
      { dataClassCategory: 'APPL2' },
      'onprem',
    );
    expect(requests).toHaveLength(1);
    if (!patched.ok) throw new Error(patched.message);

    const etag = current.etag;
    if (etag === undefined) throw new Error('the recorded read has an ETag');
    const written = await settings.updateMetadata(
      {
        tableName: 'SFLIGHT',
        transportRequest: 'DEVK900001',
        description: patched.description,
        settings: patched.settings,
      },
      {
        headers: headersOf(settings, 'updateMetadata'),
        lockHandle: 'LH/1',
        ifMatch: etag,
      },
    );
    expect(written.ok).toBe(true);
    expect(requests).toHaveLength(2);
    const put = requests[1];
    expect([put?.method, put?.url]).toEqual([
      'PUT',
      '/sap/bc/adt/ddic/db/settings/sflight?lockHandle=LH%2F1&corrNr=DEVK900001',
    ]);
    expect(put?.headers?.['If-Match']).toBe(
      '20190325110154001application/vnd.sap.adt.table.settings.v2+xmlF9+mnRD+h0kHbJVOCx4zRS71l5E=',
    );
    expect(put?.headers?.['Content-Type']).toBe(
      'application/vnd.sap.adt.table.settings.v2+xml',
    );
    expect(put?.data).toBe(
      tableSettingsDocument({
        tableName: 'SFLIGHT',
        description: current.description,
        settings: { ...current.settings, dataClassCategory: 'APPL2' },
      }),
    );
  });

  it('on the cloud, the flag read goes back with the PUT', async () => {
    const { connection, requests } = sequence([OK]);
    const settings = new AdtClientCloud(connection).getTableSettings();
    const patched = patchTableSettings(CLOUD, { sizeCategory: '2' }, 'cloud');
    if (!patched.ok) throw new Error(patched.message);
    await settings.updateMetadata(
      {
        tableName: 'Z0001FLIGHT',
        description: patched.description,
        settings: patched.settings,
      },
      { headers: headersOf(settings, 'updateMetadata'), lockHandle: 'LH' },
    );
    expect(String(requests[0]?.data)).toContain(
      `<ts:isWritableByAMDP>${CLOUD.settings.isWritableByAMDP}</ts:isWritableByAMDP>`,
    );
  });
});
